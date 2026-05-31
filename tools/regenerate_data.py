#!/usr/bin/env python3
"""Regenerate js/data.js-compatible embedded fallback data."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Optional, List

from embedded_data import extract_embedded_data, serialize_embedded_data, validate_embedded_anime_shape


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "data" / "anime.preview.json"
DEFAULT_OUTPUT = ROOT / "js" / "data.js"


def regenerate(input_path: Path = DEFAULT_INPUT, output_path: Path = DEFAULT_OUTPUT) -> None:
    if not input_path.exists():
        raise FileNotFoundError(f"Input JSON not found: {input_path}")
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    shape = validate_embedded_anime_shape(payload, sample_size=50)
    if not shape["valid"]:
        raise ValueError("Input payload shape invalid:\n- " + "\n- ".join(shape["errors"]))

    script = serialize_embedded_data(payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(script, encoding="utf-8")

    parsed = extract_embedded_data(output_path.read_text(encoding="utf-8"))
    parsed_shape = validate_embedded_anime_shape(parsed, sample_size=50)
    if not parsed_shape["valid"]:
        raise ValueError("Generated output is invalid:\n- " + "\n- ".join(parsed_shape["errors"]))

    try:
        label = output_path.relative_to(Path.cwd())
    except ValueError:
        label = output_path
    print(f"Wrote embedded data to {label}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(DEFAULT_INPUT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args(argv)
    try:
        regenerate(Path(args.input), Path(args.output))
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
