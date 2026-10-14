import shutil
from pathlib import Path

BASE_DIR = Path(r"D:\ALL_USER_DATA\SheetFillingAutomation\flipkart-tshirt-filler")
AFTER_DIR = BASE_DIR / "docs" / "ui-fix" / "after"
AFTER_DIR.mkdir(parents=True, exist_ok=True)

# Copy representative final screenshots from phases C, D, E, F
copies = [
    ("docs/ui-fix/phase-c/login-light-1440.png", "login-1440-light.png"),
    ("docs/ui-fix/phase-c/login-dark-1440.png", "login-1440-dark.png"),
    ("docs/ui-fix/phase-c/login-light-390.png", "login-390-light.png"),
    ("docs/ui-fix/phase-c/login-dark-390.png", "login-390-dark.png"),
    ("docs/ui-fix/phase-c/login-error-dark-1440.png", "login-error-1440-dark.png"),
    ("docs/ui-fix/phase-d/workspace-light-1440.png", "workspace-empty-1440-light.png"),
    ("docs/ui-fix/phase-d/workspace-dark-1440.png", "workspace-empty-1440-dark.png"),
    ("docs/ui-fix/phase-d/workspace-light-390.png", "workspace-empty-390-light.png"),
    ("docs/ui-fix/phase-d/workspace-dark-390.png", "workspace-empty-390-dark.png"),
    ("docs/ui-fix/phase-d/workspace-drawer-dark-390.png", "workspace-drawer-390-dark.png"),
    ("docs/ui-fix/phase-e/editor-all-ready-light.png", "workspace-loaded-1440-light.png"),
    ("docs/ui-fix/phase-e/editor-all-ready-dark.png", "workspace-loaded-1440-dark.png"),
    ("docs/ui-fix/phase-e/editor-empty-json-dark.png", "workspace-editor-empty-dark.png"),
    ("docs/ui-fix/phase-e/editor-invalid-json-dark.png", "workspace-editor-invalid-dark.png"),
    ("docs/ui-fix/phase-f/bulk-paste-modal-light.png", "bulk-paste-modal-light.png"),
    ("docs/ui-fix/phase-f/bulk-paste-modal-dark.png", "bulk-paste-modal-dark.png"),
    ("docs/ui-fix/phase-f/admin-overview-1440-light.png", "admin-1440-light.png"),
    ("docs/ui-fix/phase-f/admin-overview-1440-dark.png", "admin-1440-dark.png"),
    ("docs/ui-fix/phase-f/admin-overview-390-light.png", "admin-390-light.png"),
    ("docs/ui-fix/phase-f/admin-overview-390-dark.png", "admin-390-dark.png"),
    ("docs/ui-fix/phase-f/admin-create-modal-dark.png", "admin-create-modal-dark.png"),
]

for src, dst in copies:
    src_path = BASE_DIR / src
    dst_path = AFTER_DIR / dst
    if src_path.exists():
        shutil.copy2(src_path, dst_path)
        print(f"Copied {src} -> {dst}")
    else:
        print(f"Source not found: {src}")

print("All final after screenshots assembled in docs/ui-fix/after/")
