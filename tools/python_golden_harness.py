#!/usr/bin/env python3
"""Golden fixture parity harness for Python tool migrations.

The harness exercises migrated Python tools and compares representative outputs
against checked-in golden fixtures.
"""

from __future__ import annotations

import argparse
import copy
import difflib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from typing import Any, Dict, List

from embedded_data import serialize_embedded_data
from quality_reporter import build_quality_report


ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = ROOT / "test" / "fixtures" / "python-golden"
PLACEHOLDER_TIMESTAMP = "<generated-at>"


def compact_json(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"


def write_json(path: Path, payload: Any) -> None:
    path.write_text(compact_json(payload), encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def representative_catalog_input() -> Dict[str, Any]:
    episodes_alpha = [{"episode": episode, "score": 4.4 - (episode * 0.03)} for episode in range(1, 13)]
    episodes_beta = [{"episode": episode, "score": 4.0 + (episode * 0.02)} for episode in range(1, 11)]
    return {
        "anime": [
            {
                "id": "alpha",
                "malId": 101,
                "anilistId": 201,
                "title": "Alpha",
                "titleEnglish": "Alpha",
                "titleJapanese": "アルファ",
                "cover": "https://cdn.myanimelist.net/images/anime/1/1.jpg",
                "type": "TV",
                "year": 2024,
                "season": "Spring",
                "studio": "Studio A",
                "source": "Manga",
                "score": 8.1,
                "genres": ["Action", "Adventure"],
                "themes": ["School"],
                "demographic": "Shounen",
                "trailer": {
                    "id": "abc123",
                    "url": "https://www.youtube.com/watch?v=abc123",
                    "embedUrl": "https://www.youtube.com/embed/abc123",
                },
                "episodes": episodes_alpha,
            },
            {
                "id": "beta",
                "malId": 102,
                "anilistId": 202,
                "title": "Beta",
                "cover": "https://cdn.myanimelist.net/images/anime/2/2.jpg",
                "type": "TV",
                "year": 2023,
                "season": "Fall",
                "studio": "Studio B",
                "source": "Original",
                "score": 7.7,
                "genres": ["Drama"],
                "themes": ["Music"],
                "trailer": {
                    "id": "def456",
                    "url": "https://youtu.be/def456",
                    "embedUrl": "https://www.youtube.com/embed/def456",
                },
                "episodes": episodes_beta,
            },
        ]
    }


def validation_payload() -> Dict[str, Any]:
    return {
        "generatedAt": "2026-01-01T00:00:00.000Z",
        "scoreProfile": {"p35": 4.05, "p50": 4.12, "p65": 4.2, "sampleSize": 2000, "source": "fixture"},
        "anime": [{
            "id": "alpha",
            "title": "Alpha",
            "cover": "https://cdn.myanimelist.net/images/anime/1/1.jpg",
            "year": 2024,
            "season": "Spring",
            "studio": "Studio A",
            "source": "Manga",
            "score": 8.1,
            "anilistId": 201,
            "genres": ["Action"],
            "themes": ["School"],
            "episodes": [{"episode": 1, "score": 4.2}],
            "trailer": {
                "id": "abc123",
                "url": "https://www.youtube.com/watch?v=abc123",
                "embedUrl": "https://www.youtube.com/embed/abc123",
            },
            "stats": {"retentionScore": 80},
        }],
    }


def contract_manifest() -> Dict[str, Any]:
    return {
        "version": 1,
        "generatedBy": "tools/python_golden_harness.py",
        "normalizations": [
            "generatedAt fields use <generated-at>",
            "quality report buildId uses <generated-at>",
            "quality report duration uses 0",
            "temporary fixture paths use <fixture-workdir>",
        ],
        "fixtures": [
            "catalog-input.json",
            "catalog-full.json",
            "catalog-preview.json",
            "embedded-data.js",
            "quality-report.json",
            "validation-success.txt",
            "validation-failure.txt",
        ],
    }


def validation_payload() -> Dict[str, Any]:
    return {
        "generatedAt": "2026-01-01T00:00:00.000Z",
        "scoreProfile": {"p35": 4.05, "p50": 4.12, "p65": 4.2, "sampleSize": 2000, "source": "fixture"},
        "anime": [
            {
                "id": "alpha",
                "title": "Alpha",
                "cover": "https://cdn.myanimelist.net/images/anime/1/1.jpg",
                "year": 2024,
                "season": "Spring",
                "studio": "Studio A",
                "source": "Manga",
                "score": 8.1,
                "anilistId": 201,
                "genres": ["Action"],
                "themes": ["School"],
                "episodes": [{"episode": 1, "score": 4.2}],
                "trailer": {
                    "id": "abc123",
                    "url": "https://www.youtube.com/watch?v=abc123",
                    "embedUrl": "https://www.youtube.com/embed/abc123",
                },
                "stats": {"retentionScore": 80},
            }
        ],
    }


def run_command(args: List[str], *, cwd: Path = ROOT, expect_success: bool = True) -> subprocess.CompletedProcess:
    completed = subprocess.run(
        args,
        cwd=str(cwd),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    if expect_success and completed.returncode != 0:
        raise RuntimeError(f"Command failed ({completed.returncode}): {' '.join(args)}\n{completed.stdout}")
    if not expect_success and completed.returncode == 0:
        raise RuntimeError(f"Command unexpectedly passed: {' '.join(args)}\n{completed.stdout}")
    return completed


def normalize_catalog_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = copy.deepcopy(payload)
    if "generatedAt" in normalized:
        normalized["generatedAt"] = PLACEHOLDER_TIMESTAMP
    return normalized


def normalize_quality_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = copy.deepcopy(payload)
    normalized["buildId"] = PLACEHOLDER_TIMESTAMP
    normalized["duration"] = 0
    return normalized


def normalize_validation_output(output: str, workdir: Path) -> str:
    text = output.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace(str(workdir), "<fixture-workdir>")
    text = text.replace(str(workdir).replace("\\", "/"), "<fixture-workdir>")
    text = text.replace("\\", "/")
    text = __import__("re").sub(r"(?:\.\./)+\.\./tmp/rekonime-golden-[^/\s)]+", "<fixture-workdir>", text)
    text = __import__("re").sub(r"(?:\.\./)+tmp/rekonime-golden-[^/\s)]+", "<fixture-workdir>", text)
    text = __import__("re").sub(r"(?:\.\./)+AppData/Local/Temp/rekonime-golden-[^/\s)]+", "<fixture-workdir>", text)
    text = __import__("re").sub(r"[A-Za-z]:/[^)\n]*?rekonime-golden-[^/\s)]+", "<fixture-workdir>", text)
    text = __import__("re").sub(r"/tmp/rekonime-golden-[^/\s)]+", "<fixture-workdir>", text)
    text = __import__("re").sub(r"(?:\.\./)+\.\.<fixture-workdir>", "<fixture-workdir>", text)
    return text.strip() + "\n"


def build_actuals(workdir: Path) -> Dict[str, str]:
    input_path = workdir / "anime.json"
    full_path = workdir / "anime.full.json"
    preview_path = workdir / "anime.preview.json"
    report_path = workdir / "quality-report.json"
    state_path = workdir / ".build-state.json"
    validation_data_path = workdir / "validation.full.json"
    validation_embedded_path = workdir / "validation-data.js"
    validation_index_path = workdir / "index.html"
    failure_data_path = workdir / "validation-failure.full.json"
    failure_embedded_path = workdir / "validation-failure-data.js"

    write_json(input_path, representative_catalog_input())
    run_command([
        sys.executable,
        "tools/build_catalogs.py",
        str(input_path),
        str(full_path),
        str(preview_path),
        "--no-strict",
        "--report",
        "--report-path",
        str(report_path),
        "--state",
        str(state_path),
    ])

    valid_payload = validation_payload()
    write_json(validation_data_path, valid_payload)
    validation_embedded_path.write_text(serialize_embedded_data(valid_payload), encoding="utf-8")
    validation_index_path.write_text(
        '<!doctype html><html><body><script type="module" src="/js/main.ts"></script></body></html>',
        encoding="utf-8",
    )

    success = run_command([
        sys.executable,
        "tools/validate_data.py",
        "--data",
        str(validation_data_path),
        "--embedded",
        str(validation_embedded_path),
        "--index",
        str(validation_index_path),
    ])

    failure_payload = copy.deepcopy(valid_payload)
    failure_payload["anime"][0]["trailer"] = {
        "id": "bad",
        "url": "https://youtube.com.evil.example/watch?v=bad",
        "embedUrl": "https://youtube.com.evil.example/embed/bad",
    }
    write_json(failure_data_path, failure_payload)
    failure_embedded_path.write_text(serialize_embedded_data(failure_payload), encoding="utf-8")
    failure = run_command([
        sys.executable,
        "tools/validate_data.py",
        "--data",
        str(failure_data_path),
        "--embedded",
        str(failure_embedded_path),
        "--index",
        str(validation_index_path),
    ], expect_success=False)

    return {
        "catalog-input.json": compact_json(representative_catalog_input()),
        "catalog-full.json": compact_json(normalize_catalog_payload(read_json(full_path))),
        "catalog-preview.json": compact_json(normalize_catalog_payload(read_json(preview_path))),
        "embedded-data.js": serialize_embedded_data(valid_payload),
        "quality-report.json": compact_json(normalize_quality_report(build_quality_report(
            anime=read_json(full_path)["anime"],
            validation={"errors": [], "warnings": []},
            integrity_issues=[],
            score_profile=read_json(full_path)["scoreProfile"],
            duration_ms=0,
        ))),
        "validation-success.txt": normalize_validation_output(success.stdout, workdir),
        "validation-failure.txt": normalize_validation_output(failure.stdout, workdir),
        "manifest.json": compact_json(contract_manifest()),
    }


def compare_or_update(actuals: Dict[str, str], *, update: bool) -> int:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    failures = []

    for name, actual in sorted(actuals.items()):
        expected_path = FIXTURE_DIR / name
        if update or not expected_path.exists():
            expected_path.write_text(actual, encoding="utf-8")
            continue

        expected = expected_path.read_text(encoding="utf-8")
        if expected != actual:
            diff = "\n".join(difflib.unified_diff(
                expected.splitlines(),
                actual.splitlines(),
                fromfile=f"expected/{name}",
                tofile=f"actual/{name}",
                lineterm="",
            ))
            failures.append(f"{name} changed:\n{diff}")

    if failures:
        print("\n\n".join(failures))
        print("\nGolden fixture parity failed. Re-run with --update only for intentional, reviewed diffs.")
        return 1

    action = "updated" if update else "matched"
    print(f"Python golden fixtures {action}: {len(actuals)} files")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare Python data-tool golden fixtures")
    parser.add_argument("--update", action="store_true", help="rewrite golden fixtures from current JS/Bun outputs")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="rekonime-golden-") as temp_dir:
      actuals = build_actuals(Path(temp_dir))
      return compare_or_update(actuals, update=args.update)


if __name__ == "__main__":
    sys.exit(main())
