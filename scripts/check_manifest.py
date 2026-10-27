#!/usr/bin/env python3
"""Verifica se os XMLs do Android são bem formados (pega atributos duplicados, que quebram o build)."""
import glob, sys
import xml.dom.minidom as minidom

files = ["app/src/main/AndroidManifest.xml"] + glob.glob("app/src/main/res/**/*.xml", recursive=True)
bad = 0
for f in sorted(files):
    try:
        minidom.parse(f)
    except Exception as e:  # noqa: BLE001
        print(f"::error file={f}::XML inválido: {e}")
        bad += 1
print(f"{len(files)} arquivo(s) XML verificado(s), {bad} com erro.")
sys.exit(1 if bad else 0)
