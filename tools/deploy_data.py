#!/usr/bin/env python3
"""Python backup/rollback data operations with path containment checks."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
import re
import shutil
import sys
from typing import Dict, Optional, Union


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
BACKUP_DIR = DATA_DIR / "backups"
DATA_FILES = ["anime.json", "anime.full.json", "anime.preview.json"]
BACKUP_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]*$")


def normalize_backup_id(value: Optional[str]) -> str:
    return str(value or "").strip()


def is_path_inside(base_path: Path, candidate_path: Path) -> bool:
    base = base_path.resolve()
    candidate = candidate_path.resolve()
    try:
        candidate.relative_to(base)
        return True
    except ValueError:
        return False


def resolve_backup_path(backup_id: str) -> Dict[str, Union[Path, str]]:
    normalized_id = normalize_backup_id(backup_id)
    if not normalized_id:
        raise ValueError("Backup identifier is required")
    if not BACKUP_ID_PATTERN.match(normalized_id):
        raise ValueError("Invalid backup identifier")

    base_path = BACKUP_DIR.resolve()
    candidate_path = (base_path / normalized_id).resolve()
    if not is_path_inside(base_path, candidate_path):
        raise ValueError("Backup path escapes backup directory")
    if not candidate_path.exists():
        raise FileNotFoundError(f"Backup not found: {normalized_id}")
    if not candidate_path.is_dir():
        raise NotADirectoryError(f"Backup is not a directory: {normalized_id}")
    return {"id": normalized_id, "path": candidate_path}


def backup_current_data() -> Path:
    timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z").replace(":", "-").replace(".", "-")
    backup_path = BACKUP_DIR / timestamp
    backup_path.mkdir(parents=True, exist_ok=True)
    for file_name in DATA_FILES:
        source = DATA_DIR / file_name
        if source.exists():
            shutil.copyfile(source, backup_path / file_name)
    print(f"Backed up data to {backup_path}")
    return backup_path


def rollback(backup_id: str) -> None:
    resolved = resolve_backup_path(backup_id)
    backup_path = resolved["path"]
    assert isinstance(backup_path, Path)
    for file_name in DATA_FILES:
        source = backup_path / file_name
        if source.exists():
            shutil.copyfile(source, DATA_DIR / file_name)
    print(f"Rolled back to {resolved['id']}")


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", nargs="?")
    parser.add_argument("backup_id", nargs="?")
    args = parser.parse_args(argv)
    try:
        if args.command == "backup":
            backup_current_data()
            return 0
        if args.command == "rollback":
            if not args.backup_id:
                raise ValueError("Usage: python tools/deploy_data.py rollback <timestamp>")
            rollback(args.backup_id)
            return 0
        print("Usage: python tools/deploy_data.py [backup|rollback <timestamp>]")
        return 0
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
