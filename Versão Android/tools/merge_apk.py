#!/usr/bin/env python3
"""Adiciona classes.dex ao APK gerado com aapt2 preservando resources.arsc."""

from __future__ import annotations

import sys
import zipfile
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 4:
        print("Uso: merge_apk.py <apk-base> <classes.dex> <apk-saida>", file=sys.stderr)
        return 2

    base_apk = Path(sys.argv[1])
    dex_file = Path(sys.argv[2])
    output_apk = Path(sys.argv[3])

    if not base_apk.is_file():
        print(f"APK base não encontrado: {base_apk}", file=sys.stderr)
        return 1
    if not dex_file.is_file():
        print(f"classes.dex não encontrado: {dex_file}", file=sys.stderr)
        return 1

    with zipfile.ZipFile(base_apk, "r") as source:
        with zipfile.ZipFile(output_apk, "w", allowZip64=True) as destination:
            for item in source.infolist():
                data = source.read(item.filename)
                if item.filename == "resources.arsc":
                    item.compress_type = zipfile.ZIP_STORED
                destination.writestr(item, data)

            dex_info = zipfile.ZipInfo("classes.dex")
            dex_info.compress_type = zipfile.ZIP_STORED
            dex_info.external_attr = 0o100644 << 16
            destination.writestr(dex_info, dex_file.read_bytes())

    print(f"APK com classes.dex: {output_apk}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
