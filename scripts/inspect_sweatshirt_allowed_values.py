import xlrd

sweat_path = r'd:\ALL_USER_DATA\SheetFillingAutomation\C_sweatshirt_810b72b2a99846d1_2510-1554FK_REQXKQO6QIEHF.xls'
wb = xlrd.open_workbook(sweat_path)

if 'Index' in wb.sheet_names():
    sh = wb.sheet_by_name('Index')
    print("Index sheet shape:", sh.nrows, sh.ncols)
    print("Row 1:", sh.row_values(0))
    print("Row 2 (Attributes):", sh.row_values(1))
    
    # Map column headers in Row 2 to their allowed values in rows 3..nrows
    attrs = {}
    for c in range(sh.ncols):
        attr_name = str(sh.cell_value(1, c)).strip()
        if attr_name:
            vals = []
            for r in range(2, sh.nrows):
                v = str(sh.cell_value(r, c)).strip()
                if v:
                    vals.append(v)
            attrs[attr_name] = vals
            print(f"Attr '{attr_name}' ({len(vals)} values): {vals[:8]}...")

for sname in wb.sheet_names():
    if 'DropDown' in sname:
        sh = wb.sheet_by_name(sname)
        vals = [str(sh.cell_value(r, 0)).strip() for r in range(min(15, sh.nrows)) if str(sh.cell_value(r, 0)).strip()]
        print(f"Sheet '{sname}' ({sh.nrows} rows): {vals[:8]}...")
