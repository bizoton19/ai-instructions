"""Extract text from CSV and Excel."""

from __future__ import annotations

from pathlib import Path

import pandas as pd


def extract_csv_text(path: Path) -> tuple[str, dict]:
    df = pd.read_csv(path)
    meta = {"rows": len(df), "columns": list(df.columns.astype(str))}
    text = df.to_string(index=False)
    return text, meta


def extract_xlsx_text(path: Path) -> tuple[str, dict]:
    xl = pd.ExcelFile(path)
    parts: list[str] = []
    meta: dict = {"sheets": xl.sheet_names}
    for name in xl.sheet_names:
        df = pd.read_excel(xl, sheet_name=name)
        parts.append(f"=== Sheet: {name} ===\n{df.to_string(index=False)}")
    return "\n\n".join(parts), meta
