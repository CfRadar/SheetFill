"""Pydantic models and data structures for product inputs, rows, and reports."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class ProductInput(BaseModel):
    """Schema for product JSON input."""

    product_title: str
    product_description: str
    key_features: List[str]
    material: str
    pattern: str
    sleeve_type: str
    neck_type: str
    fit_type: str
    ideal_for: str
    color: str
    style_code: str

    sku_base: Optional[str] = None
    sizes: List[str] = Field(default_factory=lambda: ["S", "M", "L", "XL"])
    images: Optional[Any] = None  # Ignored: image URLs are taken from the sheet
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    occasion: Optional[str] = None
    brand_color: Optional[str] = None
    fabric_care: Optional[str] = None


class RowRecord(BaseModel):
    """Represents a single generated row in the t_shirt sheet."""

    row_index: Optional[int] = None
    size: str
    sku: str
    cells: Dict[str, Any] = Field(default_factory=dict)

    def get(self, col: str, default: Any = None) -> Any:
        return self.cells.get(col, default)

    def set(self, col: str, val: Any) -> None:
        self.cells[col] = val


class ValidationIssue(BaseModel):
    level: str  # "ERROR" or "WARNING"
    field: str
    message: str
    suggestions: List[str] = Field(default_factory=list)


class RunReport(BaseModel):
    """Execution summary report."""

    timestamp: str
    template_path: str
    output_path: Optional[str] = None
    total_products: int = 0
    rows_written: int = 0
    start_row: Optional[int] = None
    end_row: Optional[int] = None
    skus: List[str] = Field(default_factory=list)
    warnings: List[ValidationIssue] = Field(default_factory=list)
    errors: List[ValidationIssue] = Field(default_factory=list)
    success: bool = False
