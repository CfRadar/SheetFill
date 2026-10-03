"""Command Line Interface for Flipkart T-Shirt Listing Automation."""

from datetime import datetime
import json
from pathlib import Path
import sys
from typing import List, Optional
import typer
from rich.console import Console
from rich.table import Table

from .allowed_values import (
    find_stub_for_sku_base,
    load_allowed_values,
    read_existing_skus,
    read_source_sheet_stubs,
)
from .json_loader import JSONLoadError, load_products_from_path
from .mapper import ValueMapper
from .models import RunReport, ValidationIssue
from .report import FAST_VALIDATE_NOTICE, console, print_run_summary, save_run_log
from .rows import build_product_rows, determine_sku_base
from .validator import verify_workbook_content, verify_zip_integrity
from .xlsx_patch import create_patched_workbook

app = typer.Typer(
    name="flipkart-filler",
    help="Surgical, zero-corruption Flipkart T-Shirt listing workbook filler.",
    add_completion=False,
)


@app.command()
def fill(
    json_path: Path = typer.Option(
        ...,
        "--json",
        "-j",
        help="Path to product JSON file or directory containing JSON files.",
    ),
    template: Path = typer.Option(
        Path("templates/Flipkart_TShirt_Template.xlsm"),
        "--template",
        "-t",
        help="Path to Flipkart T-Shirt template workbook.",
    ),
    append_to: Optional[Path] = typer.Option(
        None,
        "--append-to",
        help="Existing .xlsm workbook to append products into.",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Validate schema and generate rows in memory without writing any workbook.",
    ),
    sku_base: Optional[str] = typer.Option(
        None,
        "--sku-base",
        help="Explicitly override the base SKU prefix.",
    ),
    source_sheet: Optional[Path] = typer.Option(
        None,
        "--source-sheet",
        help="Path to in-progress .xls/.xlsm/.xlsx workbook to copy image URLs from.",
    ),
    images_file: Optional[Path] = typer.Option(
        None,
        "--images",
        help="Deprecated. Image links are copied from --source-sheet.",
    ),
    config_dir: Path = typer.Option(
        Path("config"),
        "--config",
        "-c",
        help="Directory containing defaults.yaml and mappings.yaml.",
    ),
) -> None:
    """Fills the t_shirt sheet of the workbook from input product JSON(s)."""
    ts_now = datetime.now()
    timestamp_str = ts_now.strftime("%Y%m%d_%H%M%S")

    report = RunReport(
        timestamp=ts_now.isoformat(),
        template_path=str(template),
    )

    # 1. Determine source workbook
    source_wb = append_to if append_to else template
    if not source_wb.exists():
        console.print(f"[bold red]Source workbook not found: {source_wb}[/bold red]")
        raise typer.Exit(code=1)

    # 2. Load configurations
    defaults_file = config_dir / "defaults.yaml"
    mappings_file = config_dir / "mappings.yaml"
    if not defaults_file.exists() or not mappings_file.exists():
        console.print(
            f"[bold red]Config files not found in '{config_dir}'. Expected defaults.yaml and mappings.yaml.[/bold red]"
        )
        raise typer.Exit(code=1)

    # 3. Read allowed values from template
    console.print(f"[dim]Reading live allowed values from '{template}'...[/dim]")
    try:
        allowed_dict = load_allowed_values(template)
    except Exception as e:
        console.print(f"[bold red]Failed to inspect allowed values from template: {e}[/bold red]")
        raise typer.Exit(code=1)

    mapper = ValueMapper(mappings_file, defaults_file, allowed_dict)

    # 4. Read existing SKUs
    existing_skus = read_existing_skus(source_wb)

    # 5. Load products
    try:
        products = load_products_from_path(json_path)
    except JSONLoadError as jle:
        console.print(f"[bold red]{jle}[/bold red]")
        report.errors.append(
            ValidationIssue(level="ERROR", field="JSON Parsing", message=str(jle))
        )
        save_run_log(report, Path("logs"))
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[bold red]Failed to load product JSON: {e}[/bold red]")
        report.errors.append(
            ValidationIssue(level="ERROR", field="JSON Parsing", message=str(e))
        )
        save_run_log(report, Path("logs"))
        raise typer.Exit(code=1)

    # Source sheet stubs
    source_stubs: Dict[str, Dict[str, Any]] = {}
    if source_sheet:
        if not source_sheet.exists():
            console.print(f"[bold red]Source sheet not found: {source_sheet}[/bold red]")
            raise typer.Exit(code=1)
        console.print(f"[dim]Reading image stubs from '{source_sheet}'...[/dim]")
        source_stubs = read_source_sheet_stubs(source_sheet)
    else:
        console.print(
            "[bold yellow]WARNING: No --source-sheet provided. Image cells AU..BA will remain blank.[/bold yellow]"
        )

    for p in products:
        if sku_base:
            p.sku_base = sku_base

    # Check for duplicate image URLs across different designs
    seen_urls: Dict[str, str] = {}
    for prod in products:
        p_base = prod.sku_base or determine_sku_base(prod)
        s_data = find_stub_for_sku_base(source_stubs, p_base) if source_sheet else None
        if s_data:
            for c in ["AU", "AV", "AW", "AX", "AY", "AZ", "BA"]:
                u = s_data.get(c)
                if u:
                    if u in seen_urls and seen_urls[u] != p_base:
                        report.warnings.append(
                            ValidationIssue(
                                level="WARNING",
                                field=c,
                                message=f"Duplicate image URL '{u}' is used by both '{seen_urls[u]}' and '{p_base}'",
                            )
                        )
                    else:
                        seen_urls[u] = p_base

    # 6. Generate rows for all products
    all_rows = []
    for prod in products:
        p_base = prod.sku_base or determine_sku_base(prod)
        s_data = find_stub_for_sku_base(source_stubs, p_base) if source_sheet else None
        p_rows, p_issues = build_product_rows(prod, mapper, existing_skus, source_sheet_data=s_data)
        for issue in p_issues:
            if issue.level == "ERROR":
                report.errors.append(issue)
            else:
                report.warnings.append(issue)
        all_rows.extend(p_rows)

    if report.errors:
        print_run_summary(report)
        save_run_log(report, Path("logs"))
        raise typer.Exit(code=1)

    report.total_products = len(products)
    report.rows_written = len(all_rows)
    report.skus = [r.sku for r in all_rows]

    # If dry-run, stop here and show preview
    if dry_run:
        console.print(
            f"[bold yellow]DRY RUN COMPLETE: {len(all_rows)} rows validated successfully. No files written.[/bold yellow]"
        )
        preview_table = Table(title="Generated Rows Preview", border_style="cyan")
        preview_table.add_column("Size", style="cyan")
        preview_table.add_column("SKU", style="green")
        preview_table.add_column("Color (AS)", style="white")
        preview_table.add_column("Neck (AH)", style="white")
        preview_table.add_column("Sleeve (AL)", style="white")
        preview_table.add_column("Fabric (AJ)", style="white")
        preview_table.add_column("Ideal For (AK)", style="white")
        for r in all_rows:
            preview_table.add_row(
                r.size,
                r.sku,
                r.get("AS"),
                r.get("AH"),
                r.get("AL"),
                r.get("AJ"),
                r.get("AK"),
            )
        console.print(preview_table)
        return

    # 7. Determine output path
    if append_to:
        output_file = append_to
    else:
        out_dir = Path("output")
        out_dir.mkdir(parents=True, exist_ok=True)
        stem = json_path.stem if json_path.is_file() else "batch"
        output_file = out_dir / f"{stem}_{timestamp_str}.xlsm"

    console.print(f"[dim]Patching workbook -> '{output_file}'...[/dim]")
    try:
        start_row, end_row, patch_issues = create_patched_workbook(
            source_workbook_path=source_wb,
            output_workbook_path=output_file,
            rows=all_rows,
        )
        for issue in patch_issues:
            if issue.level == "ERROR":
                report.errors.append(issue)
            else:
                report.warnings.append(issue)

        report.start_row = start_row
        report.end_row = end_row
        report.output_path = str(output_file)
    except Exception as e:
        console.print(f"[bold red]Failed to patch workbook: {e}[/bold red]")
        report.errors.append(
            ValidationIssue(level="ERROR", field="Workbook Patch", message=str(e))
        )
        save_run_log(report, Path("logs"))
        raise typer.Exit(code=1)

    # 8. Post-write verification
    console.print("[dim]Running post-write integrity verification...[/dim]")
    zip_issues = verify_zip_integrity(template, output_file)
    content_issues = verify_workbook_content(
        output_file,
        template,
        expected_rows=all_rows,
        start_row=report.start_row,
        allowed_values=allowed_dict,
    )
    for issue in zip_issues + content_issues:
        if issue.level == "ERROR":
            report.errors.append(issue)
        else:
            report.warnings.append(issue)

    if report.errors:
        report.success = False
        print_run_summary(report)
        save_run_log(report, Path("logs"))
        raise typer.Exit(code=1)

    report.success = True
    print_run_summary(report)
    save_run_log(report, Path("logs"))


@app.command()
def check(
    workbook: Path = typer.Option(..., "--workbook", "-w", help="Output workbook to verify."),
    template: Path = typer.Option(
        Path("templates/Flipkart_TShirt_Template.xlsm"),
        "--template",
        "-t",
        help="Template workbook for baseline integrity check.",
    ),
) -> None:
    """Verifies the integrity and data correctness of a generated workbook."""
    if not workbook.exists():
        console.print(f"[bold red]Workbook not found: {workbook}[/bold red]")
        raise typer.Exit(code=1)
    if not template.exists():
        console.print(f"[bold red]Template workbook not found: {template}[/bold red]")
        raise typer.Exit(code=1)

    console.print(f"[cyan]Verifying '{workbook}' against template '{template}'...[/cyan]")
    zip_issues = verify_zip_integrity(template, workbook)
    allowed_dict = load_allowed_values(template)
    content_issues = verify_workbook_content(
        workbook,
        template,
        allowed_values=allowed_dict,
    )

    all_issues = zip_issues + content_issues
    errors = [i for i in all_issues if i.level == "ERROR"]
    warnings = [i for i in all_issues if i.level == "WARNING"]

    if errors:
        console.print(f"[bold red]FAILED: Found {len(errors)} error(s):[/bold red]")
        for err in errors:
            console.print(f"  [red]- {err.field}: {err.message}[/red]")
        raise typer.Exit(code=1)

    if warnings:
        console.print(f"[bold yellow]Found {len(warnings)} warning(s):[/bold yellow]")
        for w in warnings:
            console.print(f"  [yellow]- {w.field}: {w.message}[/yellow]")

    console.print("[bold green]PASSED: Workbook integrity and content validated successfully![/bold green]")
    console.print(f"\n[bold green]{FAST_VALIDATE_NOTICE}[/bold green]\n")


@app.command()
def show_allowed(
    attribute: str = typer.Option(
        ...,
        "--attribute",
        "-a",
        help="Attribute name to display allowed values for (e.g. Color, Fabric, Sleeve, Neck).",
    ),
    template: Path = typer.Option(
        Path("templates/Flipkart_TShirt_Template.xlsm"),
        "--template",
        "-t",
        help="Template workbook to read allowed values from.",
    ),
) -> None:
    """Displays allowed dropdown values for an attribute from the workbook."""
    if not template.exists():
        console.print(f"[bold red]Template workbook not found: {template}[/bold red]")
        raise typer.Exit(code=1)

    allowed_dict = load_allowed_values(template)
    vals = allowed_dict.get(attribute.lower())
    if not vals:
        console.print(f"[bold red]No allowed values found for '{attribute}'.[/bold red]")
        avail = sorted(list(set(k for k in allowed_dict.keys() if len(k) > 2)))
        console.print(f"Available attributes: {', '.join(avail)}")
        raise typer.Exit(code=1)

    table = Table(title=f"Allowed Values for '{attribute}'", border_style="cyan")
    table.add_column("#", justify="right", style="cyan")
    table.add_column("Allowed Value", style="bold white")
    for idx, v in enumerate(vals, start=1):
        table.add_row(str(idx), v)
    console.print(table)


if __name__ == "__main__":
    app()
