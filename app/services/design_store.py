"""Design store service for disk-based session persistence and autosave."""

import json
import os
from pathlib import Path
import shutil
import time
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.services.design_detector import DetectedDesign, DetectionResult, DetectionSummary


class SessionState(BaseModel):
    """Full session state stored on disk."""

    session_id: str
    original_filename: str
    created_at: float
    updated_at: float
    summary: DetectionSummary
    designs: List[DetectedDesign]
    design_jsons: Dict[str, Dict[str, Any]] = Field(default_factory=dict)  # did -> raw & parsed JSON
    design_raw_text: Dict[str, str] = Field(default_factory=dict)
    design_sizes: Dict[str, List[str]] = Field(default_factory=dict)  # did -> custom sizes if ticked
    design_image_edits: Dict[str, List[Optional[str]]] = Field(default_factory=dict)
    design_product_links: Dict[str, Optional[str]] = Field(default_factory=dict)
    design_meta: Dict[str, Dict[str, str]] = Field(default_factory=dict)  # did -> {"brand": ..., "manufacturer": ..., "hsn": ...}
    global_meta: Dict[str, str] = Field(default_factory=dict)  # {"brand": ..., "manufacturer": ..., "hsn": ...}
    output_filename: Optional[str] = None
    report: Optional[Dict[str, Any]] = None


class DesignStore:
    """Manages session folders on disk in app/workspace/sessions/<uuid>/."""

    def __init__(self, workspace_dir: Optional[str] = None):
        if not workspace_dir:
            base_dir = Path(__file__).resolve().parent.parent
            workspace_dir = str(base_dir / "workspace" / "sessions")
        self.workspace_dir = Path(workspace_dir)
        self.workspace_dir.mkdir(parents=True, exist_ok=True)

    def _session_dir(self, session_id: str) -> Path:
        return self.workspace_dir / session_id

    def create_session(
        self,
        filename: str,
        file_bytes: bytes,
        detection_result: DetectionResult,
    ) -> SessionState:
        """Initializes a new session folder and saves the uploaded file."""
        sid = str(uuid.uuid4())
        sdir = self._session_dir(sid)
        sdir.mkdir(parents=True, exist_ok=True)
        (sdir / "jsons").mkdir(parents=True, exist_ok=True)

        # Save uploaded file
        upload_path = sdir / f"upload_{filename}"
        with open(upload_path, "wb") as f:
            f.write(file_bytes)

        now = time.time()
        state = SessionState(
            session_id=sid,
            original_filename=filename,
            created_at=now,
            updated_at=now,
            summary=detection_result.summary,
            designs=detection_result.designs,
        )
        self.save_session(state)
        return state

    def get_session(self, session_id: str) -> Optional[SessionState]:
        """Loads session state from disk."""
        sdir = self._session_dir(session_id)
        state_file = sdir / "state.json"
        if not state_file.exists():
            return None
        with open(state_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return SessionState.model_validate(data)

    def save_session(self, state: SessionState) -> None:
        """Persists session state to disk."""
        sdir = self._session_dir(state.session_id)
        sdir.mkdir(parents=True, exist_ok=True)
        state.updated_at = time.time()
        state_file = sdir / "state.json"
        with open(state_file, "w", encoding="utf-8") as f:
            f.write(state.model_dump_json(indent=2))

    def update_summary(self, state: SessionState) -> None:
        """Recalculates summary counts on the session."""
        total = len(state.designs)
        needs_json = sum(1 for d in state.designs if d.status == "needs_json")
        partial = sum(1 for d in state.designs if d.status == "partial")
        complete = sum(1 for d in state.designs if d.status == "complete")
        state.summary.total = total
        state.summary.needs_json = needs_json
        state.summary.partial = partial
        state.summary.complete = complete

    def add_slots(self, session_id: str, count: int) -> Optional[SessionState]:
        """Appends manual stub designs to the session."""
        state = self.get_session(session_id)
        if not state:
            return None

        current_max = 0
        for d in state.designs:
            if d.id.startswith("d") and d.id[1:].isdigit():
                current_max = max(current_max, int(d.id[1:]))

        for i in range(count):
            current_max += 1
            did = f"d{current_max}"
            new_design = DetectedDesign(
                id=did,
                kind="stub",
                status="needs_json",
                base=None,
                sheet_rows=[],
                sizes_found=[],
                image_urls=[None] * 7,
                main_image_url=None,
                palette_url=None,
                video_url=None,
                supplier_image=None,
                product_link=None,
                is_manual_slot=True,
                existing_values={},
                missing_required=["K", "L", "BM"],
                warnings=["Manual slot added."],
            )
            state.designs.append(new_design)

        self.update_summary(state)
        self.save_session(state)
        return state

    def delete_design(self, session_id: str, design_id: str, force: bool = False) -> bool:
        """Deletes a design from the session."""
        state = self.get_session(session_id)
        if not state:
            return False

        target = None
        for d in state.designs:
            if d.id == design_id:
                target = d
                break

        if not target:
            return False

        if target.kind == "expanded" and not force:
            raise ValueError(f"Design '{design_id}' is an expanded design. Pass force=true to delete.")

        state.designs = [d for d in state.designs if d.id != design_id]
        state.design_jsons.pop(design_id, None)
        state.design_raw_text.pop(design_id, None)
        state.design_sizes.pop(design_id, None)
        state.design_image_edits.pop(design_id, None)
        state.design_product_links.pop(design_id, None)
        state.design_meta.pop(design_id, None)

        self.update_summary(state)
        self.save_session(state)
        return True

    def save_design_json(
        self,
        session_id: str,
        design_id: str,
        raw_text: str,
        parsed_json: Dict[str, Any],
        status: str,
        warnings: List[str],
        errors: List[str],
    ) -> Optional[SessionState]:
        """Saves JSON for a design and updates its status."""
        state = self.get_session(session_id)
        if not state:
            return None

        state.design_raw_text[design_id] = raw_text
        state.design_jsons[design_id] = parsed_json

        # Write file into jsons/
        sdir = self._session_dir(session_id)
        with open(sdir / "jsons" / f"{design_id}.json", "w", encoding="utf-8") as f:
            json.dump(parsed_json, f, indent=2)

        for d in state.designs:
            if d.id == design_id:
                d.status = status
                d.warnings = warnings
                if d.base is None and parsed_json.get("sku_base"):
                    d.base = parsed_json["sku_base"]
                break

        self.update_summary(state)
        self.save_session(state)
        return state

    def save_design_images(
        self,
        session_id: str,
        design_id: str,
        image_urls: List[Optional[str]],
        product_link: Optional[str] = None,
    ) -> Optional[SessionState]:
        """Updates the 7 image URLs and product link for a design."""
        state = self.get_session(session_id)
        if not state:
            return None

        # Pad to 7 items
        urls = list(image_urls)
        while len(urls) < 7:
            urls.append(None)
        urls = urls[:7]

        state.design_image_edits[design_id] = urls
        if product_link is not None:
            state.design_product_links[design_id] = product_link

        for d in state.designs:
            if d.id == design_id:
                d.image_urls = urls
                d.main_image_url = urls[0] if urls[0] else None
                if product_link is not None:
                    d.product_link = product_link
                break

        self.save_session(state)
        return state

    def save_design_sizes(
        self,
        session_id: str,
        design_id: str,
        sizes: List[str],
    ) -> Optional[SessionState]:
        """Updates the sizes for a design."""
        state = self.get_session(session_id)
        if not state:
            return None

        state.design_sizes[design_id] = sizes
        for d in state.designs:
            if d.id == design_id:
                d.sizes_found = sizes
                break

        self.save_session(state)
        return state

    def save_design_meta(
        self,
        session_id: str,
        design_id: str,
        brand: Optional[str] = None,
        manufacturer: Optional[str] = None,
        hsn: Optional[str] = None,
    ) -> Optional[SessionState]:
        """Updates brand, manufacturer, and HSN for a specific design."""
        state = self.get_session(session_id)
        if not state:
            return None

        cur = state.design_meta.get(design_id, {})
        if brand is not None:
            cur["brand"] = brand.strip()
        if manufacturer is not None:
            cur["manufacturer"] = manufacturer.strip()
        if hsn is not None:
            cur["hsn"] = hsn.strip()
        state.design_meta[design_id] = cur

        self.save_session(state)
        return state

    def apply_meta_to_all(
        self,
        session_id: str,
        brand: Optional[str] = None,
        manufacturer: Optional[str] = None,
        hsn: Optional[str] = None,
    ) -> Optional[SessionState]:
        """Applies brand, manufacturer, and HSN to all designs and updates global_meta."""
        state = self.get_session(session_id)
        if not state:
            return None

        meta = dict(state.global_meta)
        if brand is not None:
            meta["brand"] = brand.strip()
        if manufacturer is not None:
            meta["manufacturer"] = manufacturer.strip()
        if hsn is not None:
            meta["hsn"] = hsn.strip()

        state.global_meta = meta
        for d in state.designs:
            cur = state.design_meta.get(d.id, {})
            cur.update(meta)
            state.design_meta[d.id] = cur

        self.save_session(state)
        return state

    def clean_old_sessions(self, max_age_hours: int = 24) -> int:
        """Deletes sessions older than max_age_hours."""
        now = time.time()
        cutoff = now - (max_age_hours * 3600)
        deleted = 0
        if not self.workspace_dir.exists():
            return 0

        for item in self.workspace_dir.iterdir():
            if item.is_dir():
                state_file = item / "state.json"
                if state_file.exists():
                    try:
                        with open(state_file, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        updated = data.get("updated_at", 0)
                        if updated < cutoff:
                            shutil.rmtree(item, ignore_errors=True)
                            deleted += 1
                    except Exception:
                        pass
        return deleted
