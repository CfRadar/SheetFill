"""API router implementing all endpoints specified in Section 6."""

import asyncio
from datetime import datetime
import json
import os
from pathlib import Path
import time
from typing import Any, Dict, List, Optional, Set
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from app.activity import log_event
from app.api.schemas import (
    AddSlotsRequest,
    AnalyzeResponse,
    BulkAssignRequest,
    BulkAssignResponse,
    BulkConfirmRequest,
    GenerateRequest,
    GenerateResponse,
    MatchAssignmentItem,
    PreviewRow,
    PutImagesRequest,
    PutJsonRequest,
    PutJsonResponse,
    PutSizesRequest,
    SessionResponse,
    BrandMetaRequest,
)
from app.auth import CurrentUser, require_user
from app.services.builder import build_design_rows, get_default_mapper
from app.services.bulk_matcher import match_bulk_json, parse_batch_json
from app.services.design_detector import detect_designs
from app.services.design_store import DesignStore, SessionState
from app.services.sheet_reader import read_tshirt_sheet
from app.services.writer import rebuild_tshirt_workbook
from flipkart_filler.allowed_values import load_allowed_values
from flipkart_filler.json_loader import JSONLoadError, parse_single_json_content, sanitize_json_text
from flipkart_filler.models import ValidationIssue

router = APIRouter(prefix="/api", dependencies=[Depends(require_user)])
store = DesignStore()


def _get_master_template_path() -> str:
    base_dir = Path(__file__).resolve().parent.parent.parent
    return str(base_dir / "templates" / "Flipkart_TShirt_Template.xlsm")


def _json_error(status_code: int, code: str, message: str, details: Any = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details}},
    )


@router.get("/allowed-values/{attribute}")
def get_allowed_values(attribute: str, user: CurrentUser = Depends(require_user)) -> Dict[str, Any]:
    master_path = _get_master_template_path()
    allowed_map = load_allowed_values(master_path)
    attr_lower = attribute.lower().strip()
    vals = allowed_map.get(attr_lower, [])
    return {"attribute": attribute, "values": vals}


@router.post("/sheets/analyze")
async def analyze_sheet(
    request: Request,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_user),
) -> Any:
    # 25 MB max limit enforced via 1 MB chunked streaming to prevent memory exhaustion
    CHUNK_SIZE = 1024 * 1024  # 1 MB
    MAX_BYTES = 25 * 1024 * 1024  # 25 MB
    chunks = []
    total_size = 0
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_BYTES:
            return _json_error(413, "FILE_TOO_LARGE", f"File size exceeds 25 MB limit")
        chunks.append(chunk)
    contents = b"".join(chunks)

    filename = file.filename or "upload.xlsm"
    ext = Path(filename).suffix.lower()
    if ext not in [".xls", ".xlsm", ".xlsx"]:
        return _json_error(400, "INVALID_FORMAT", f"Unsupported format '{ext}'. Must be .xls, .xlsm, or .xlsx")

    # Validate Excel magic bytes
    if ext in [".xlsx", ".xlsm"] and not contents.startswith(b"PK\x03\x04"):
        return _json_error(400, "INVALID_FORMAT", f"File '{filename}' is not a valid Excel OpenXML archive.")
    if ext == ".xls" and not (contents.startswith(b"\xd0\xcf\x11\xe0") or contents.startswith(b"PK\x03\x04")):
        return _json_error(400, "INVALID_FORMAT", f"File '{filename}' is not a valid Excel file.")

    # Save to temp location to parse
    temp_dir = Path(__file__).resolve().parent.parent / "workspace" / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_file = temp_dir / f"tmp_{filename}"
    try:
        with open(temp_file, "wb") as f:
            f.write(contents)

        try:
            raw_sheet = read_tshirt_sheet(str(temp_file), _get_master_template_path())
        except ValueError as ve:
            return _json_error(400, "SHEET_READ_ERROR", str(ve))
        except Exception as e:
            return _json_error(400, "UNREADABLE_FILE", f"Could not read workbook: {str(e)}")

        detection_res = detect_designs(raw_sheet)
        session = store.create_session(filename, contents, detection_res, user_id=user.id)
        if user.brand_defaults:
            session.global_meta = dict(user.brand_defaults)
            for d in session.designs:
                session.design_meta[d.id] = dict(user.brand_defaults)
            store.save_session(session)

        await log_event(
            event_type="upload_sheet",
            user=user,
            request=request,
            session_id=session.session_id,
            meta={"filename": filename, "designs_count": len(session.designs)},
        )

        return AnalyzeResponse(
            session_id=session.session_id,
            filename=filename,
            summary=session.summary,
            designs=session.designs,
        )
    finally:
        if temp_file.exists():
            temp_file.unlink()


@router.get("/sheets/{sid}")
def get_session_state(sid: str, user: CurrentUser = Depends(require_user)) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    if user.brand_defaults:
        changed = False
        if not session.global_meta:
            session.global_meta = dict(user.brand_defaults)
            changed = True
        for d in session.designs:
            if d.id not in session.design_meta:
                session.design_meta[d.id] = dict(user.brand_defaults)
                changed = True
        if changed:
            store.save_session(session)

    download_url = (
        f"/api/sheets/{sid}/download?t={int(session.updated_at)}"
        if session.output_filename
        else None
    )

    return SessionResponse(
        session_id=session.session_id,
        filename=session.original_filename,
        created_at=session.created_at,
        updated_at=session.updated_at,
        summary=session.summary,
        designs=session.designs,
        design_jsons=session.design_jsons,
        design_raw_text=session.design_raw_text,
        design_sizes=session.design_sizes,
        design_image_edits=session.design_image_edits,
        design_product_links=session.design_product_links,
        design_meta=session.design_meta,
        global_meta=session.global_meta,
        download_url=download_url,
        output_filename=session.output_filename,
        report=session.report,
    )


@router.post("/sheets/{sid}/add-slots")
def add_slots(sid: str, req: AddSlotsRequest, user: CurrentUser = Depends(require_user)) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    updated = store.add_slots(sid, req.count, user_id=user.id)
    if not updated:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")
    return {"status": "ok", "summary": updated.summary, "designs": updated.designs}


@router.delete("/sheets/{sid}/designs/{did}")
def delete_design(sid: str, did: str, force: bool = Query(False), user: CurrentUser = Depends(require_user)) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    try:
        ok = store.delete_design(sid, did, force=force, user_id=user.id)
        if not ok:
            return _json_error(404, "DESIGN_NOT_FOUND", f"Design '{did}' not found in session")
        updated = store.get_session(sid, user_id=user.id)
        if not updated:
            return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")
        return {"status": "ok", "summary": updated.summary, "designs": updated.designs}
    except ValueError as ve:
        return _json_error(400, "DELETE_FORBIDDEN", str(ve))


@router.put("/sheets/{sid}/designs/{did}/json")
def put_design_json(sid: str, did: str, req: PutJsonRequest, user: CurrentUser = Depends(require_user)) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    target_design = next((d for d in session.designs if d.id == did), None)
    if not target_design:
        return _json_error(404, "DESIGN_NOT_FOUND", f"Design '{did}' not found")

    # Tolerant parsing
    raw_text = req.raw_text.strip()
    if not raw_text:
        store.save_design_json(
            session_id=sid,
            design_id=did,
            raw_text="",
            parsed_json={},
            status="needs_json",
            warnings=[],
            errors=[],
            user_id=user.id,
        )
        return PutJsonResponse(
            status="needs_json",
            repaired=False,
            errors=[],
            warnings=[],
            parsed_json=None,
            preview_rows=[],
        )

    was_repaired = False
    try:
        sanitized = sanitize_json_text(raw_text)
        if sanitized != raw_text:
            was_repaired = True
        parsed_items = parse_single_json_content(raw_text)
        parsed_json = parsed_items[0] if parsed_items else {}
    except JSONLoadError as jle:
        store.save_design_json(
            session_id=sid,
            design_id=did,
            raw_text=req.raw_text,
            parsed_json={},
            status="invalid",
            warnings=[],
            errors=[str(jle)],
            user_id=user.id,
        )
        return PutJsonResponse(
            status="invalid",
            repaired=False,
            errors=[ValidationIssue(level="ERROR", field="JSON", message=str(jle))],
            warnings=[],
            parsed_json=None,
            preview_rows=[],
        )
    except Exception as e:
        store.save_design_json(
            session_id=sid,
            design_id=did,
            raw_text=req.raw_text,
            parsed_json={},
            status="invalid",
            warnings=[],
            errors=[str(e)],
            user_id=user.id,
        )
        return PutJsonResponse(
            status="invalid",
            repaired=False,
            errors=[ValidationIssue(level="ERROR", field="JSON", message=f"Could not parse JSON: {str(e)}")],
            warnings=[],
            parsed_json=None,
            preview_rows=[],
        )

    # Mapper & builder
    mapper = get_default_mapper(_get_master_template_path())

    # Collect existing SKUs in session from other designs
    existing_skus = set()
    for d in session.designs:
        if d.id != did and d.id in session.design_jsons:
            pass

    custom_sizes = session.design_sizes.get(did)
    image_edits = session.design_image_edits.get(did)
    prod_link_edit = session.design_product_links.get(did)
    meta_override = dict(session.global_meta or {})
    meta_override.update(session.design_meta.get(did, {}))

    target_idx = next((i + 1 for i, d in enumerate(session.designs) if d.id == did), 1)
    b_res = build_design_rows(
        design=target_design,
        json_data=parsed_json,
        mapper=mapper,
        existing_skus_in_session=existing_skus,
        custom_sizes=custom_sizes,
        image_edits=image_edits,
        product_link_edit=prod_link_edit,
        meta_override=meta_override,
        design_index=target_idx,
    )

    # Save to store
    store.save_design_json(
        session_id=sid,
        design_id=did,
        raw_text=req.raw_text,
        parsed_json=parsed_json,
        status=b_res.status,
        warnings=[w.message for w in b_res.warnings],
        errors=[e.message for e in b_res.errors],
        user_id=user.id,
    )

    preview_rows = [
        PreviewRow(
            sheet_row_index=r.row_index,
            size=r.size,
            cells=r.cells,
        )
        for r in b_res.rows
    ]

    return PutJsonResponse(
        status=b_res.status,
        repaired=was_repaired,
        errors=b_res.errors,
        warnings=b_res.warnings,
        parsed_json=parsed_json,
        preview_rows=preview_rows,
    )


@router.put("/sheets/{sid}/designs/{did}/images")
def put_design_images(
    sid: str,
    did: str,
    req: PutImagesRequest,
    unlock: Optional[bool] = Query(None),
    user: CurrentUser = Depends(require_user),
) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    target_design = next((d for d in session.designs if d.id == did), None)
    if not target_design:
        return _json_error(404, "DESIGN_NOT_FOUND", f"Design '{did}' not found")

    is_unlocked = req.unlock or (unlock is True)
    if not target_design.is_manual_slot and not is_unlocked:
        return _json_error(
            409,
            "SHEET_IMAGES_LOCKED",
            "Image links for sheet-derived designs are read-only from your sheet. Pass unlock=true to edit.",
        )

    # Validate URLs
    for url in req.urls:
        if url and not url.startswith("https://"):
            return _json_error(400, "INVALID_URL", f"Image URL '{url}' must start with 'https://'")

    updated = store.save_design_images(sid, did, req.urls, req.product_link, user_id=user.id)
    if not updated:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")
    return {"status": "ok", "design": next((d for d in updated.designs if d.id == did), None)}


@router.put("/sheets/{sid}/designs/{did}/sizes")
def put_design_sizes(
    sid: str,
    did: str,
    req: PutSizesRequest,
    user: CurrentUser = Depends(require_user),
) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    master_path = _get_master_template_path()
    allowed_sizes = load_allowed_values(master_path).get("brand size", ["S", "M", "L", "XL"])
    for s in req.sizes:
        if not any(s.strip().lower() == a.lower() for a in allowed_sizes):
            return _json_error(400, "INVALID_SIZE", f"Size '{s}' is not an allowed Brand Size")

    updated = store.save_design_sizes(sid, did, req.sizes, user_id=user.id)
    if not updated:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    target_design = next((d for d in updated.designs if d.id == did), None)
    preview_rows = []
    if target_design and did in updated.design_jsons:
        mapper = get_default_mapper(_get_master_template_path())
        meta_override = dict(updated.global_meta or {})
        meta_override.update(updated.design_meta.get(did, {}))
        target_idx = next((i + 1 for i, d in enumerate(updated.designs) if d.id == did), 1)
        b_res = build_design_rows(
            design=target_design,
            json_data=updated.design_jsons[did],
            mapper=mapper,
            existing_skus_in_session=set(),
            custom_sizes=req.sizes,
            image_edits=updated.design_image_edits.get(did),
            product_link_edit=updated.design_product_links.get(did),
            meta_override=meta_override,
            design_index=target_idx,
        )
        store.save_design_json(
            session_id=sid,
            design_id=did,
            raw_text=updated.design_raw_text.get(did, ""),
            parsed_json=updated.design_jsons[did],
            status=b_res.status,
            warnings=[w.message for w in b_res.warnings],
            errors=[e.message for e in b_res.errors],
            user_id=user.id,
        )
        preview_rows = [
            PreviewRow(sheet_row_index=r.row_index, size=r.size, cells=r.cells)
            for r in b_res.rows
        ]
        updated = store.get_session(sid, user_id=user.id)

    return {
        "status": "ok",
        "design": next((d for d in updated.designs if d.id == did), None),
        "preview_rows": preview_rows,
        "design_sizes": updated.design_sizes.get(did, req.sizes),
    }


@router.put("/sheets/{sid}/designs/{did}/meta")
def put_design_meta(
    sid: str,
    did: str,
    req: BrandMetaRequest,
    user: CurrentUser = Depends(require_user),
) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    target_design = next((d for d in session.designs if d.id == did), None)
    if not target_design:
        return _json_error(404, "DESIGN_NOT_FOUND", f"Design '{did}' not found")

    updated = store.save_design_meta(
        session_id=sid,
        design_id=did,
        brand=req.brand,
        manufacturer=req.manufacturer,
        packer=req.packer,
        hsn=req.hsn,
        mrp=str(req.mrp) if req.mrp is not None else None,
        selling_price=str(req.selling_price) if req.selling_price is not None else None,
        sleeve=req.sleeve,
        user_id=user.id,
    )
    if not updated:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    # Re-evaluate design status if json exists
    preview_rows = []
    if did in updated.design_jsons:
        mapper = get_default_mapper(_get_master_template_path())
        meta_override = dict(updated.global_meta or {})
        meta_override.update(updated.design_meta.get(did, {}))
        target_idx = next((i + 1 for i, d in enumerate(updated.designs) if d.id == did), 1)
        b_res = build_design_rows(
            design=target_design,
            json_data=updated.design_jsons[did],
            mapper=mapper,
            existing_skus_in_session=set(),
            custom_sizes=updated.design_sizes.get(did),
            image_edits=updated.design_image_edits.get(did),
            product_link_edit=updated.design_product_links.get(did),
            meta_override=meta_override,
            design_index=target_idx,
        )
        store.save_design_json(
            session_id=sid,
            design_id=did,
            raw_text=updated.design_raw_text.get(did, ""),
            parsed_json=updated.design_jsons[did],
            status=b_res.status,
            warnings=[w.message for w in b_res.warnings],
            errors=[e.message for e in b_res.errors],
            user_id=user.id,
        )
        preview_rows = [
            PreviewRow(sheet_row_index=r.row_index, size=r.size, cells=r.cells)
            for r in b_res.rows
        ]
        updated = store.get_session(sid, user_id=user.id)

    return {
        "status": "ok",
        "design_meta": updated.design_meta.get(did, {}),
        "preview_rows": preview_rows,
        "design": next((d for d in updated.designs if d.id == did), None),
    }


@router.post("/sheets/{sid}/meta/apply-all")
def apply_meta_all(
    sid: str,
    req: BrandMetaRequest,
    user: CurrentUser = Depends(require_user),
) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    updated = store.apply_meta_to_all(
        session_id=sid,
        brand=req.brand,
        manufacturer=req.manufacturer,
        packer=req.packer,
        hsn=req.hsn,
        mrp=str(req.mrp) if req.mrp is not None else None,
        selling_price=str(req.selling_price) if req.selling_price is not None else None,
        sleeve=req.sleeve,
        user_id=user.id,
    )
    if not updated:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    # Persist brand defaults for the user so every new sheet remembers them
    from app.db import get_db, is_db_connected
    if is_db_connected():
        try:
            db = get_db()
            updates = {}
            if req.brand is not None:
                updates["brand_defaults.brand"] = req.brand.strip()
            if req.manufacturer is not None:
                updates["brand_defaults.manufacturer"] = req.manufacturer.strip()
            if req.packer is not None:
                updates["brand_defaults.packer"] = req.packer.strip()
            if req.hsn is not None:
                updates["brand_defaults.hsn"] = req.hsn.strip()
            if req.mrp is not None:
                updates["brand_defaults.mrp"] = str(req.mrp).strip()
            if req.selling_price is not None:
                updates["brand_defaults.selling_price"] = str(req.selling_price).strip()
            if req.sleeve is not None:
                updates["brand_defaults.sleeve"] = req.sleeve.strip()
            if updates:
                import asyncio
                from bson import ObjectId
                from app.cache import invalidate_session
                asyncio.create_task(db.users.update_one({"_id": ObjectId(user.id)}, {"$set": updates}))
                invalidate_session(user.session_id)
        except Exception:
            pass

    # Re-evaluate all designs that have JSON
    mapper = get_default_mapper(_get_master_template_path())
    for idx, d in enumerate(updated.designs, start=1):
        if d.id in updated.design_jsons:
            meta_override = dict(updated.global_meta or {})
            meta_override.update(updated.design_meta.get(d.id, {}))
            b_res = build_design_rows(
                design=d,
                json_data=updated.design_jsons[d.id],
                mapper=mapper,
                existing_skus_in_session=set(),
                custom_sizes=updated.design_sizes.get(d.id),
                image_edits=updated.design_image_edits.get(d.id),
                product_link_edit=updated.design_product_links.get(d.id),
                meta_override=meta_override,
                design_index=idx,
            )
            store.save_design_json(
                session_id=sid,
                design_id=d.id,
                raw_text=updated.design_raw_text.get(d.id, ""),
                parsed_json=updated.design_jsons[d.id],
                status=b_res.status,
                warnings=[w.message for w in b_res.warnings],
                errors=[e.message for e in b_res.errors],
                user_id=user.id,
            )

    refreshed = store.get_session(sid, user_id=user.id)
    return {
        "status": "ok",
        "global_meta": refreshed.global_meta,
        "design_meta": refreshed.design_meta,
        "designs": refreshed.designs,
        "summary": refreshed.summary,
    }


@router.post("/sheets/{sid}/bulk-assign")
def bulk_assign(
    sid: str,
    req: BulkAssignRequest,
    user: CurrentUser = Depends(require_user),
) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    match_res = match_bulk_json(req.raw_text, session.designs)
    assigned_items = [
        MatchAssignmentItem(
            design_id=a.design_id,
            json_index=a.json_index,
            how=a.how,
            parsed_json=a.parsed_json,
            design_base=a.design_base,
            json_base=a.json_base,
            confidence=a.confidence,
            requires_confirmation=a.requires_confirmation,
        )
        for a in match_res.assigned
    ]

    return BulkAssignResponse(
        assigned=assigned_items,
        unmatched_json=match_res.unmatched_json,
        unmatched_designs=match_res.unmatched_designs,
    )


@router.post("/sheets/{sid}/bulk-assign/confirm")
def bulk_confirm(
    sid: str,
    req: BulkConfirmRequest,
    user: CurrentUser = Depends(require_user),
) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    mapper = get_default_mapper(_get_master_template_path())
    applied = []
    errors = []

    for pair in req.pairs:
        did = pair.design_id
        target_design = next((d for d in session.designs if d.id == did), None)
        if not target_design:
            errors.append(f"Design {did} not found")
            continue

        jobj = pair.parsed_json or {}
        meta_override = dict(session.global_meta or {})
        meta_override.update(session.design_meta.get(did, {}))
        target_idx = next((i + 1 for i, d in enumerate(session.designs) if d.id == did), 1)

        b_res = build_design_rows(
            design=target_design,
            json_data=jobj,
            mapper=mapper,
            existing_skus_in_session=set(),
            custom_sizes=session.design_sizes.get(did),
            image_edits=session.design_image_edits.get(did),
            product_link_edit=session.design_product_links.get(did),
            meta_override=meta_override,
            design_index=target_idx,
        )

        store.save_design_json(
            session_id=sid,
            design_id=did,
            raw_text=json.dumps(jobj, indent=2),
            parsed_json=jobj,
            status=b_res.status,
            warnings=[w.message for w in b_res.warnings],
            errors=[e.message for e in b_res.errors],
            user_id=user.id,
        )
        applied.append({"design_id": did, "status": b_res.status})

    updated = store.get_session(sid, user_id=user.id)
    return {"status": "ok", "applied": applied, "errors": errors, "summary": updated.summary}


@router.get("/sheets/{sid}/designs/{did}/json-template")
def get_json_template(sid: str, did: str, user: CurrentUser = Depends(require_user)) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    target = next((d for d in session.designs if d.id == did), None)
    if not target:
        return _json_error(404, "DESIGN_NOT_FOUND", f"Design '{did}' not found")

    skeleton = {
        "product_title": "",
        "product_description": "",
        "key_features": [
            "Premium cotton fabric",
            "Graphic print design",
            "Comfortable fit for everyday wear",
        ],
        "material": target.existing_values.get("AJ", "Cotton Blend"),
        "pattern": target.existing_values.get("AI", "Graphic Print"),
        "sleeve_type": target.existing_values.get("AL", "Half Sleeve"),
        "neck_type": target.existing_values.get("AH", "Round Neck"),
        "fit_type": target.existing_values.get("AO", "Regular"),
        "ideal_for": target.existing_values.get("AK", "Men"),
        "color": target.existing_values.get("AS", "Black"),
        "brand_color": target.existing_values.get("AT", "Black"),
        "style_code": target.existing_values.get("AQ", ""),
        "mrp": float(target.existing_values.get("K", 1999)),
        "selling_price": float(target.existing_values.get("L", 749)),
        "occasion": target.existing_values.get("AM", "Casual"),
    }
    return skeleton


@router.post("/sheets/{sid}/generate")
async def generate_workbook(
    sid: str,
    req: GenerateRequest,
    request: Request,
    user: CurrentUser = Depends(require_user),
) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    mapper = get_default_mapper(_get_master_template_path())

    # Build ready rows map
    ready_rows_map: Dict[str, List] = {}
    existing_skus: Set[str] = set()
    blocked_or_invalid: List[str] = []

    for idx, d in enumerate(session.designs, start=1):
        if d.id in session.design_jsons:
            jobj = session.design_jsons[d.id]
            meta_override = dict(session.global_meta or {})
            meta_override.update(session.design_meta.get(d.id, {}))

            b_res = build_design_rows(
                design=d,
                json_data=jobj,
                mapper=mapper,
                existing_skus_in_session=existing_skus,
                custom_sizes=session.design_sizes.get(d.id),
                image_edits=session.design_image_edits.get(d.id),
                product_link_edit=session.design_product_links.get(d.id),
                meta_override=meta_override,
                design_index=idx,
            )
            if b_res.status == "ready":
                ready_rows_map[d.id] = b_res.rows
            else:
                blocked_or_invalid.append(d.id)
        elif d.status in ["invalid", "blocked", "needs_json"]:
            blocked_or_invalid.append(d.id)

    if req.mode == "all_or_nothing" and blocked_or_invalid:
        return _json_error(
            409,
            "DESIGNS_NOT_READY",
            f"Cannot generate workbook in all_or_nothing mode: designs {blocked_or_invalid} are not ready.",
            {"blocked_designs": blocked_or_invalid},
        )

    if not ready_rows_map and not any(d.status == "complete" for d in session.designs):
        return _json_error(400, "NO_READY_DESIGNS", "At least one design must be ready to generate.")

    # Generate workbook with base name in .xls format
    sdir = store._session_dir(sid)
    orig_name = session.original_filename or "sheet.xls"
    base_name = Path(orig_name).stem
    out_filename = f"{base_name}.xls"
    out_path = sdir / out_filename

    try:
        out_file, report = await asyncio.to_thread(
            rebuild_tshirt_workbook,
            master_template_path=_get_master_template_path(),
            output_path=str(out_path),
            designs=session.designs,
            ready_rows_map=ready_rows_map,
            mode=req.mode,
        )
    except ValueError as ve:
        return _json_error(400, "GENERATION_ERROR", str(ve))
    except Exception as e:
        return _json_error(500, "INTERNAL_ERROR", f"Generation failed: {str(e)}")

    session.output_filename = out_filename
    session.report = report
    store.save_session(session)

    rows_count = report.get("total_rows", 0) if isinstance(report, dict) else 0
    await log_event(
        event_type="generate_rows",
        user=user,
        request=request,
        session_id=sid,
        meta={"mode": req.mode, "output_filename": out_filename, "rows_count": rows_count},
    )

    download_url = f"/api/sheets/{sid}/download?t={int(time.time())}"
    return GenerateResponse(download_url=download_url, report=report, filename=out_filename)


@router.get("/sheets/{sid}/download")
async def download_workbook(
    sid: str,
    request: Request,
    user: CurrentUser = Depends(require_user),
) -> Any:
    session = store.get_session(sid, user_id=user.id)
    if not session:
        return _json_error(404, "FILE_NOT_FOUND", "Session not found.")

    sdir = store._session_dir(sid)
    orig_name = session.original_filename or "sheet.xls"
    base_name = Path(orig_name).stem
    target_filename = session.output_filename or f"{base_name}.xls"

    fpath = sdir / target_filename
    if not fpath.exists():
        alt_xls = sdir / f"{base_name}.xls"
        alt_xlsm = sdir / f"{base_name}.xlsm"
        if alt_xls.exists():
            fpath = alt_xls
        elif alt_xlsm.exists():
            fpath = alt_xlsm

    # Auto-regenerate on demand if missing from disk (e.g. server restart or ephemeral container)
    if not fpath or not fpath.exists():
        try:
            mapper = get_default_mapper()
            existing_skus: Set[str] = set()
            ready_rows_map: Dict[str, Any] = {}
            for idx, d in enumerate(session.designs, start=1):
                if d.id in session.design_jsons:
                    jobj = session.design_jsons[d.id]
                    meta_override = dict(session.global_meta or {})
                    meta_override.update(session.design_meta.get(d.id, {}))
                    b_res = build_design_rows(
                        design=d,
                        json_data=jobj,
                        mapper=mapper,
                        existing_skus_in_session=existing_skus,
                        custom_sizes=session.design_sizes.get(d.id),
                        image_edits=session.design_image_edits.get(d.id),
                        product_link_edit=session.design_product_links.get(d.id),
                        meta_override=meta_override,
                        design_index=idx,
                    )
                    if b_res.status == "ready":
                        ready_rows_map[d.id] = b_res.rows

            if ready_rows_map or any(d.status == "complete" for d in session.designs):
                gen_name = f"{base_name}.xls"
                gen_path = sdir / gen_name
                out_file, report = await asyncio.to_thread(
                    rebuild_tshirt_workbook,
                    master_template_path=_get_master_template_path(),
                    output_path=str(gen_path),
                    designs=session.designs,
                    ready_rows_map=ready_rows_map,
                    mode="ready_only",
                )
                session.output_filename = gen_name
                session.report = report
                store.save_session(session)
                fpath = gen_path
        except Exception:
            pass

    if not fpath or not fpath.exists():
        return _json_error(
            404,
            "FILE_NOT_FOUND",
            "Generated workbook not found for this session. Please click 'Generate .xls' to create the sheet.",
        )

    await log_event(
        event_type="download_workbook",
        user=user,
        request=request,
        session_id=sid,
        meta={"filename": fpath.name},
    )

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Content-Disposition": f'attachment; filename="{fpath.name}"',
    }

    media_type = (
        "application/vnd.ms-excel"
        if fpath.suffix.lower() == ".xls"
        else "application/vnd.ms-excel.sheet.macroEnabled.12"
        if fpath.suffix.lower() == ".xlsm"
        else "application/vnd.ms-excel"
    )

    return FileResponse(
        path=str(fpath),
        filename=fpath.name,
        media_type=media_type,
        headers=headers,
    )
