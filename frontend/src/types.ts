export interface DetectedDesign {
  id: string;
  kind: "expanded" | "stub";
  status: "complete" | "partial" | "needs_json" | "ready" | "invalid" | "blocked";
  base: string | null;
  sheet_rows: number[];
  sizes_found: string[];
  image_urls: (string | null)[];
  main_image_url: string | null;
  palette_url?: string | null;
  video_url?: string | null;
  supplier_image?: string | null;
  product_link: string | null;
  is_manual_slot?: boolean;
  existing_values: Record<string, any>;
  missing_required: string[];
  warnings: string[];
}

export interface DetectionSummary {
  total: number;
  needs_json: number;
  partial: number;
  complete: number;
  free_rows: number;
  room_for_new_designs: number;
  capacity_designs: number;
}

export interface SessionState {
  session_id: string;
  filename: string;
  created_at: number;
  updated_at: number;
  summary: DetectionSummary;
  designs: DetectedDesign[];
  design_jsons: Record<string, any>;
  design_raw_text: Record<string, string>;
  design_sizes: Record<string, string[]>;
  design_image_edits: Record<string, (string | null)[]>;
  design_product_links: Record<string, string | null>;
  download_url?: string | null;
  report?: any;
}

export interface ValidationIssue {
  level: "ERROR" | "WARNING";
  field: string;
  message: string;
  suggestions?: string[];
}

export interface PreviewRow {
  sheet_row_index?: number;
  size: string;
  cells: Record<string, any>;
}

export interface PutJsonResponse {
  status: "ready" | "invalid" | "blocked" | "needs_json";
  repaired: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  parsed_json?: any;
  preview_rows: PreviewRow[];
}

export interface MatchAssignment {
  design_id: string;
  json_index: number;
  how: "exact" | "normalized" | "suffix" | "fuzzy" | "order";
  parsed_json: any;
  design_base?: string | null;
  json_base?: string | null;
  confidence: number;
  requires_confirmation: boolean;
}

export interface BulkAssignResponse {
  assigned: MatchAssignment[];
  unmatched_json: { json_index: number; parsed_json: any }[];
  unmatched_designs: string[];
}
