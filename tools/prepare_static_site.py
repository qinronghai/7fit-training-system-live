#!/usr/bin/env python3
"""Prepare the static GitHub Pages artifact with a deployment-specific cache key."""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

BUILD_TOKEN = "__BUILD_ID__"
RESOURCE_URL_RE = re.compile(
    r'(?P<prefix>\b(?:src|href)=")'
    r'(?P<url>(?:assets|data|js)/[^"?]+\.(?:css|js|jpeg|jpg|png|svg|webp))'
    r'(?P<suffix>")'
)


def normalize_build_id(value: str) -> str:
    build_id = value.strip()
    if not build_id:
        raise ValueError("build id must not be empty")
    return build_id[:8]


def version_index(index_html: str, build_id: str) -> str:
    short_id = normalize_build_id(build_id)

    def add_version(match: re.Match[str]) -> str:
        return (
            f'{match.group("prefix")}{match.group("url")}'
            f'?v={short_id}{match.group("suffix")}'
        )

    versioned = RESOURCE_URL_RE.sub(add_version, index_html)
    return versioned.replace(BUILD_TOKEN, short_id)


def prepare_site(root: Path, dest: Path, build_id: str) -> None:
    root = root.resolve()
    dest = dest.resolve()

    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)

    shutil.copy2(root / "index.html", dest / "index.html")
    for directory in ("assets", "data", "js"):
        shutil.copytree(root / directory, dest / directory)

    index_path = dest / "index.html"
    index_path.write_text(
        version_index(index_path.read_text(encoding="utf-8"), build_id),
        encoding="utf-8",
    )
    (dest / ".nojekyll").touch()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--dest", type=Path, default=Path("_site"))
    parser.add_argument("--build-id", required=True)
    args = parser.parse_args()
    prepare_site(args.root, args.dest, args.build_id)


if __name__ == "__main__":
    main()
