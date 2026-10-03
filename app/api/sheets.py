"""API router implementing all endpoints specified in Section 6."""

from datetime import datetime
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse

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
)
from app.services.builder import build_design_rows, get_default_mapper
from app.services.bulk_matcher import match_bulk_json, parse_batch_json
from app.services.design_detector import detect_designs
from app.services.design_store import DesignStore, SessionState
from app.services.sheet_reader import read_tshirt_sheet
from app.services.writer import rebuild_tshirt_workbook
from flipkart_filler.allowed_values import load_allowed_values
from flipkart_filler.json_loader import JSONLoadError, parse_single_json_content, sanitize_json_text
from flipkart_filler.models import ValidationIssue

router = APIRouter(prefix="/api")
store = DesignStore()


def _get_master_template_path() -> str:
    base_dir = Path(__file__).resolve().parent.parent.parent
    return str(base_dir / "templates" / "Flipkart_TShirt_Template.xlsm")


def _json_error(status_code: int, code: str, message: str, details: Any = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details}},
    )


@router.get("/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@router.get("/allowed-values/{attribute}")
def get_allowed_values(attribute: str) -> Dict[str, Any]:
    master_path = _get_master_template_path()
    allowed_map = load_allowed_values(master_path)
    attr_lower = attribute.lower().strip()
    vals = allowed_map.get(attr_lower, [])
    return {"attribute": attribute, "values": vals}


@router.post("/sheets/analyze")
async def analyze_sheet(file: UploadFile = File(...)) -> Any:
    # 25 MB max limit
    MAX_BYTES = 25 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_BYTES:
        return _json_error(413, "FILE_TOO_LARGE", f"File size exceeds 25 MB limit ({len(contents)} bytes)")

    filename = file.filename or "upload.xlsm"
    ext = Path(filename).suffix.lower()
    if ext not in [".xls", ".xlsm", ".xlsx"]:
        return _json_error(400, "INVALID_FORMAT", f"Unsupported format '{ext}'. Must be .xls, .xlsm, or .xlsx")

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
        session = store.create_session(filename, contents, detection_res)

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
def get_session_state(sid: str) -> Any:
    session = store.get_session(sid)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    download_url = f"/api/sheets/{sid}/download" if session.output_filename else None

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
        download_url=download_url,
        report=session.report,
    )


@router.post("/sheets/{sid}/add-slots")
def add_slots(sid: str, req: AddSlotsRequest) -> Any:
    session = store.get_session(sid)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    updated = store.add_slots(sid, req.count)
    return {"status": "ok", "summary": updated.summary, "designs": updated.designs}


@router.delete("/sheets/{sid}/designs/{did}")
def delete_design(sid: str, did: str, force: bool = Query(False)) -> Any:
    session = store.get_session(sid)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    try:
        ok = store.delete_design(sid, did, force=force)
        if not ok:
            return _json_error(404, "DESIGN_NOT_FOUND", f"Design '{did}' not found in session")
        updated = store.get_session(sid)
        return {"status": "ok", "summary": updated.summary, "designs": updated.designs}
    except ValueError as ve:
        return _json_error(400, "DELETE_FORBIDDEN", str(ve))


@router.put("/sheets/{sid}/designs/{did}/json")
def put_design_json(sid: str, did: str, req: PutJsonRequest) -> Any:
    session = store.get_session(sid)
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
            # We don't clash with ourselves
            pass

    custom_sizes = session.design_sizes.get(did)
    image_edits = session.design_image_edits.get(did)
    prod_link_edit = session.design_product_links.get(did)

    b_res = build_design_rows(
        design=target_design,
        json_data=parsed_json,
        mapper=mapper,
        existing_skus_in_session=existing_skus,
        custom_sizes=custom_sizes,
        image_edits=image_edits,
        product_link_edit=prod_link_edit,
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
) -> Any:
    session = store.get_session(sid)
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

    updated = store.save_design_images(sid, did, req.urls, req.product_link)
    return {"status": "ok", "design": next((d for d in updated.designs if d.id == did), None)}


@router.put("/sheets/{sid}/designs/{did}/sizes")
def put_design_sizes(sid: str, did: str, req: PutSizesRequest) -> Any:
    session = store.get_session(sid)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    master_path = _get_master_template_path()
    allowed_sizes = load_allowed_values(master_path).get("brand size", ["S", "M", "L", "XL"])
    for s in req.sizes:
        if not any(s.strip().lower() == a.lower() for a in allowed_sizes):
            return _json_error(400, "INVALID_SIZE", f"Size '{s}' is not an allowed Brand Size")

    updated = store.save_design_sizes(sid, did, req.sizes)
    return {"status": "ok", "design": next((d for d in updated.designs if d.id == did), None)}


@router.post("/sheets/{sid}/bulk-assign")
def bulk_assign(sid: str, req: BulkAssignRequest) -> Any:
    session = store.get_session(sid)
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
def bulk_confirm(sid: str, req: BulkConfirmRequest) -> Any:
    session = store.get_session(sid)
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
        b_res = build_design_rows(
            design=target_design,
            json_data=jobj,
            mapper=mapper,
            existing_skus_in_session=set(),
            custom_sizes=session.design_sizes.get(did),
            image_edits=session.design_image_edits.get(did),
            product_link_edit=session.design_product_links.get(did),
        )

        store.save_design_json(
            session_id=sid,
            design_id=did,
            raw_text=json.dumps(jobj, indent=2),
            parsed_json=jobj,
            status=b_res.status,
            warnings=[w.message for w in b_res.warnings],
            errors=[e.message for e in b_res.errors],
        )
        applied.append({"design_id": did, "status": b_res.status})

    updated = store.get_session(sid)
    return {"status": "ok", "applied": applied, "errors": errors, "summary": updated.summary}


@router.get("/sheets/{sid}/designs/{did}/json-template")
def get_json_template(sid: str, did: str) -> Any:
    session = store.get_session(sid)
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
def generate_workbook(sid: str, req: GenerateRequest) -> Any:
    session = store.get_session(sid)
    if not session:
        return _json_error(404, "SESSION_NOT_FOUND", f"Session '{sid}' not found")

    mapper = get_default_mapper(_get_master_template_path())

    # Build ready rows map
    ready_rows_map: Dict[str, List] = {}
    existing_skus: Set[str] = set()
    blocked_or_invalid: List[str] = []

    for d in session.designs:
        if d.id in session.design_jsons:
            jobj = session.design_jsons[d.id]
            b_res = build_design_rows(
                design=d,
                json_data=jobj,
                mapper=mapper,
                existing_skus_in_session=existing_skus,
                custom_sizes=session.design_sizes.get(d.id),
                image_edits=session.design_image_edits.get(d.id),
                product_link_edit=session.design_product_links.get(d.id),
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

    # Generate workbook
    sdir = store._session_dir(sid)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = Path(session.original_filename).stem
    out_filename = f"{base_name}_filled_{ts}.xlsm"
    out_path = sdir / out_filename

    try:
        out_file, report = rebuild_tshirt_workbook(
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

    download_url = f"/api/sheets/{sid}/download"
    return GenerateResponse(download_url=download_url, report=report)


@router.get("/sheets/{sid}/download")
def download_workbook(sid: str) -> Any:
    session = store.get_session(sid)
    if not session or not session.output_filename:
        return _json_error(404, "FILE_NOT_FOUND", "Generated workbook not found for this session.")

    sdir = store._session_dir(sid)
    fpath = sdir / session.output_filename
    if not fpath.exists():
        return _json_error(404, "FILE_NOT_FOUND", f"File '{session.output_filename}' not found on disk.")

    return FileResponse(
        path=str(fpath),
        filename=session.output_filename,
        media_type="application/vnd.ms-excel.sheet.macroEnabled.12",
    )
