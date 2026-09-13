#!/usr/bin/env python3
"""Fail CI when deployed HTML/CSS contains a literal backslash-n artifact."""

from __future__ import annotations

import argparse
from pathlib import Path

TEXT_EXTENSIONS = {".html", ".css"}
LITERAL_NEWLINE = "\\n"


def iter_text_files(targets: list[Path]):
    for target in targets:
        if not target.exists():
            raise FileNotFoundError(f"artifact hygiene target does not exist: {target}")
        if target.is_file():
            if target.suffix.lower() in TEXT_EXTENSIONS:
                yield target
            continue
        for path in sorted(target.rglob("*")):
            if path.is_file() and path.suffix.lower() in TEXT_EXTENSIONS:
                yield path


def find_literal_newlines(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    findings: list[str] = []
    start = 0
    while True:
        index = text.find(LITERAL_NEWLINE, start)
        if index < 0:
            break
        line = text.count("\n", 0, index) + 1
        previous_newline = text.rfind("\n", 0, index)
        column = index - previous_newline
        findings.append(f"{path}:{line}:{column}: literal \\\\n")
        start = index + len(LITERAL_NEWLINE)
    return findings


def scan_targets(targets: list[Path]) -> list[str]:
    findings: list[str] = []
    for path in iter_text_files(targets):
        findings.extend(find_literal_newlines(path))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Check source/deployed HTML and CSS for literal \\n artifacts."
    )
    parser.add_argument("targets", nargs="+", type=Path)
    args = parser.parse_args()

    try:
        findings = scan_targets(args.targets)
    except (FileNotFoundError, UnicodeDecodeError) as exc:
        print(f"artifact hygiene: FAIL: {exc}")
        return 2

    if findings:
        print("artifact hygiene: FAIL")
        for finding in findings:
            print(f"  {finding}")
        return 1

    print("artifact hygiene: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
