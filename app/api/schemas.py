"""Pydantic v2 schemas for API requests and responses."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.services.design_detector import DetectedDesign, DetectionSummary
from flipkart_filler.models import ValidationIssue


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Any] = None


class ErrorResponse(BaseModel):
    error: ErrorDetail


class AnalyzeResponse(BaseModel):
    session_id: str
    filename: str
    summary: DetectionSummary
    designs: List[DetectedDesign]


class SessionResponse(BaseModel):
    session_id: str
    filename: str
    created_at: float
    updated_at: float
    summary: DetectionSummary
    designs: List[DetectedDesign]
    design_jsons: Dict[str, Dict[str, Any]]
    design_raw_text: Dict[str, str]
    design_sizes: Dict[str, List[str]]
    design_image_edits: Dict[str, List[Optional[str]]]
    design_product_links: Dict[str, Optional[str]]
    download_url: Optional[str] = None
    output_filename: Optional[str] = None
    report: Optional[Dict[str, Any]] = None


class AddSlotsRequest(BaseModel):
    count: int = Field(..., ge=1, le=120)


class PutJsonRequest(BaseModel):
    raw_text: str


class PreviewRow(BaseModel):
    sheet_row_index: Optional[int] = None
    size: str
    cells: Dict[str, Any]


class PutJsonResponse(BaseModel):
    status: str  # "ready" | "invalid" | "blocked" | "needs_json"
    repaired: bool = False
    errors: List[ValidationIssue] = Field(default_factory=list)
    warnings: List[ValidationIssue] = Field(default_factory=list)
    parsed_json: Optional[Dict[str, Any]] = None
    preview_rows: List[PreviewRow] = Field(default_factory=list)


class PutImagesRequest(BaseModel):
    urls: List[Optional[str]]
    product_link: Optional[str] = None
    unlock: bool = False


class PutSizesRequest(BaseModel):
    sizes: List[str]


class BulkAssignRequest(BaseModel):
    raw_text: str


class MatchAssignmentItem(BaseModel):
    design_id: str
    json_index: int
    how: str
    parsed_json: Dict[str, Any]
    design_base: Optional[str] = None
    json_base: Optional[str] = None
    confidence: float
    requires_confirmation: bool


class BulkAssignResponse(BaseModel):
    assigned: List[MatchAssignmentItem]
    unmatched_json: List[Dict[str, Any]]
    unmatched_designs: List[str]


class ConfirmPair(BaseModel):
    design_id: str
    json_index: int
    parsed_json: Optional[Dict[str, Any]] = None


class BulkConfirmRequest(BaseModel):
    pairs: List[ConfirmPair]


class GenerateRequest(BaseModel):
    mode: str = "ready_only"  # "ready_only" | "all_or_nothing"


class GenerateResponse(BaseModel):
    download_url: str
    report: Dict[str, Any]
    filename: Optional[str] = None
