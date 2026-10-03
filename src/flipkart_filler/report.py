"""Console and JSON reporting with Rich tables and execution logs."""

import json
from pathlib import Path
from typing import List
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .models import RunReport, ValidationIssue

console = Console(safe_box=True)

FAST_VALIDATE_NOTICE = "Open the file in Excel, press Ctrl+Shift+S on the t_shirt sheet (Fast Validate), then upload."


def print_run_summary(report: RunReport) -> None:
    """Renders a readable summary table to the console."""
    if report.errors:
        console.print(
            Panel(
                f"[bold red]Execution Encountered {len(report.errors)} Error(s) - No file was written[/bold red]",
                title="[red]Failed[/red]",
                border_style="red",
                safe_box=True,
            )
        )
        err_table = Table(title="Errors", border_style="red", show_header=True, safe_box=True)
        err_table.add_column("Field", style="bold cyan")
        err_table.add_column("Message", style="red")
        err_table.add_column("Suggestions", style="yellow")
        for err in report.errors:
            err_table.add_row(
                err.field,
                err.message,
                ", ".join(err.suggestions) if err.suggestions else "-",
            )
        console.print(err_table)
        return

    # Success Table
    summary_table = Table(title="Flipkart T-Shirt Automation Summary", border_style="green", safe_box=True)
    summary_table.add_column("Metric", style="bold cyan")
    summary_table.add_column("Value", style="bold white")

    summary_table.add_row("Status", "[green]Success[/green]")
    summary_table.add_row("Products Processed", str(report.total_products))
    summary_table.add_row("Total Rows Written", str(report.rows_written))
    if report.start_row and report.end_row:
        summary_table.add_row("Row Range", f"Rows {report.start_row} to {report.end_row}")
    if report.output_path:
        summary_table.add_row("Output Workbook", str(report.output_path))

    console.print(summary_table)

    if report.skus:
        sku_table = Table(title="Generated Seller SKUs", border_style="cyan", safe_box=True)
        sku_table.add_column("Row", justify="right", style="cyan")
        sku_table.add_column("Seller SKU ID", style="bold green")
        start = report.start_row or 5
        for idx, sku in enumerate(report.skus):
            sku_table.add_row(str(start + idx), sku)
        console.print(sku_table)

    if report.warnings:
        warn_table = Table(title="Warnings", border_style="yellow", safe_box=True)
        warn_table.add_column("Field", style="bold cyan")
        warn_table.add_column("Message", style="yellow")
        for w in report.warnings:
            warn_table.add_row(w.field, w.message)
        console.print(warn_table)

    console.print(f"\n[bold green]{FAST_VALIDATE_NOTICE}[/bold green]\n")


def save_run_log(report: RunReport, logs_dir: Path) -> Path:
    """Persists execution report to logs/run_<timestamp>.json."""
    logs_dir.mkdir(parents=True, exist_ok=True)
    clean_ts = report.timestamp.replace(":", "").replace("-", "")
    log_file = logs_dir / f"run_{clean_ts}.json"
    with open(log_file, "w", encoding="utf-8") as f:
        json.dump(report.model_dump(), f, indent=2)
    return log_file
