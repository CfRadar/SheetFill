"""End-to-end integration tests for CLI filling and duplicate SKU prevention."""

from pathlib import Path
import shutil
from typer.testing import CliRunner

from flipkart_filler.cli import app
from flipkart_filler.allowed_values import read_existing_skus

runner = CliRunner(env={"PYTHONIOENCODING": "utf-8"})

ROOT_DIR = Path(__file__).parent.parent
TEMPLATE_PATH = ROOT_DIR / "templates" / "Flipkart_TShirt_Template.xlsm"
CONFIG_DIR = ROOT_DIR / "config"
FIXTURES_DIR = ROOT_DIR / "tests" / "fixtures"


def test_end_to_end_moonlight_and_duplicate_prevention(tmp_path):
    output_xlsm = tmp_path / "moonlight_run.xlsm"
    shutil.copyfile(TEMPLATE_PATH, output_xlsm)

    json_path = FIXTURES_DIR / "moonlight.json"

    # 1. First run: fill moonlight into output_xlsm
    result1 = runner.invoke(
        app,
        [
            "fill",
            "--json",
            str(json_path),
            "--template",
            str(TEMPLATE_PATH),
            "--append-to",
            str(output_xlsm),
            "--config",
            str(CONFIG_DIR),
        ],
    )

    assert result1.exit_code == 0, f"Run 1 failed with output: {result1.output}"
    assert "Open the file in Excel, press Ctrl+Shift+S on the t_shirt sheet" in result1.output
    assert "Rows 37 to 40" in result1.output

    # Verify that rows 37..40 have the new SKUs
    skus_after_1 = read_existing_skus(output_xlsm)
    assert "moonlight_os_S" in skus_after_1
    assert "moonlight_os_M" in skus_after_1
    assert "moonlight_os_L" in skus_after_1
    assert "moonlight_os_XL" in skus_after_1

    # 2. Second run: try to fill the exact same product into the same output workbook
    result2 = runner.invoke(
        app,
        [
            "fill",
            "--json",
            str(json_path),
            "--template",
            str(TEMPLATE_PATH),
            "--append-to",
            str(output_xlsm),
            "--config",
            str(CONFIG_DIR),
        ],
    )

    # Must STOP with error on duplicate SKU
    assert result2.exit_code != 0
    assert "Duplicate Seller SKU ID" in result2.output or "duplicate" in result2.output.lower()


def test_cli_check_command(tmp_path):
    output_xlsm = tmp_path / "check_target.xlsm"
    shutil.copyfile(TEMPLATE_PATH, output_xlsm)

    result = runner.invoke(
        app,
        [
            "check",
            "--workbook",
            str(output_xlsm),
            "--template",
            str(TEMPLATE_PATH),
        ],
    )
    assert result.exit_code == 0
    assert "PASSED" in result.output


def test_cli_show_allowed():
    result = runner.invoke(
        app,
        [
            "show-allowed",
            "--attribute",
            "Color",
            "--template",
            str(TEMPLATE_PATH),
        ],
    )
    assert result.exit_code == 0
    assert "Beige" in result.output
    assert "Black" in result.output


def test_cli_fill_xls_output(tmp_path):
    output_xls = tmp_path / "output.xls"
    xls_template = ROOT_DIR / "templates" / "Flipkart_TShirt_Template.xls"
    shutil.copyfile(xls_template, output_xls)
    json_path = FIXTURES_DIR / "moonlight.json"

    result = runner.invoke(
        app,
        [
            "fill",
            "--json",
            str(json_path),
            "--template",
            str(xls_template),
            "--append-to",
            str(output_xls),
            "--config",
            str(CONFIG_DIR),
        ],
    )
    assert result.exit_code == 0
    assert output_xls.exists()
    with open(output_xls, "rb") as f:
        magic = f.read(8)
    assert magic.startswith(b"\xd0\xcf\x11\xe0")
