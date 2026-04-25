#!/usr/bin/env python3
"""Prepare LifeUpgrade chat examples for Gemma LoRA fine-tuning."""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_PATH = PROJECT_ROOT / "lifeupgrade-training-data-quality-rated.jsonl"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "training" / "data"
DEFAULT_TRAIN_PATH = DEFAULT_OUTPUT_DIR / "lifeupgrade_train.jsonl"
DEFAULT_EVAL_PATH = DEFAULT_OUTPUT_DIR / "lifeupgrade_eval.jsonl"
ALLOWED_ROLES = {"system", "user", "assistant"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Filter, clean, and split LifeUpgrade training examples.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT_PATH, help="Source JSONL file.")
    parser.add_argument("--train-output", type=Path, default=DEFAULT_TRAIN_PATH, help="Train JSONL output path.")
    parser.add_argument("--eval-output", type=Path, default=DEFAULT_EVAL_PATH, help="Eval JSONL output path.")
    parser.add_argument("--min-quality", type=float, default=4.0, help="Minimum qualityRating to keep.")
    parser.add_argument("--eval-ratio", type=float, default=0.10, help="Fraction of kept examples for eval.")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic shuffle seed.")
    return parser.parse_args()


def coerce_quality_rating(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def get_quality_rating(record: dict[str, Any]) -> float | None:
    metadata = record.get("metadata")
    candidates = [
        record.get("qualityRating"),
        record.get("quality_rating"),
        record.get("rating"),
    ]

    if isinstance(metadata, dict):
        candidates.extend(
            [
                metadata.get("qualityRating"),
                metadata.get("quality_rating"),
                metadata.get("rating"),
            ],
        )

    for candidate in candidates:
        rating = coerce_quality_rating(candidate)
        if rating is not None:
            return rating

    return None


def normalize_messages(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list) or not value:
        raise ValueError("messages must be a non-empty list")

    messages: list[dict[str, str]] = []
    for index, message in enumerate(value):
        if not isinstance(message, dict):
            raise ValueError(f"message {index} must be an object")

        role = message.get("role")
        content = message.get("content")

        if role not in ALLOWED_ROLES:
            raise ValueError(f"message {index} has unsupported role {role!r}")
        if not isinstance(content, str) or not content.strip():
            raise ValueError(f"message {index} must have non-empty string content")

        messages.append({"role": role, "content": content.strip()})

    if not any(message["role"] == "assistant" for message in messages):
        raise ValueError("messages must include an assistant response")

    return messages


def read_filtered_examples(input_path: Path, min_quality: float) -> tuple[list[dict[str, Any]], dict[str, int]]:
    examples: list[dict[str, Any]] = []
    stats = {
        "read": 0,
        "kept": 0,
        "low_quality": 0,
        "invalid": 0,
    }

    with input_path.open("r", encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue

            stats["read"] += 1

            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise SystemExit(f"Invalid JSON on line {line_number}: {exc}") from exc

            if not isinstance(record, dict):
                stats["invalid"] += 1
                print(f"Skipping line {line_number}: record must be an object.", file=sys.stderr)
                continue

            quality_rating = get_quality_rating(record)
            if quality_rating is None or quality_rating < min_quality:
                stats["low_quality"] += 1
                continue

            try:
                messages = normalize_messages(record.get("messages"))
            except ValueError as exc:
                stats["invalid"] += 1
                print(f"Skipping line {line_number}: {exc}.", file=sys.stderr)
                continue

            examples.append({"messages": messages})
            stats["kept"] += 1

    return examples, stats


def split_examples(
    examples: list[dict[str, Any]],
    eval_ratio: float,
    seed: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if not 0 < eval_ratio < 1:
        raise SystemExit("--eval-ratio must be between 0 and 1.")
    if not examples:
        raise SystemExit("No examples passed the quality filter.")

    shuffled = list(examples)
    random.Random(seed).shuffle(shuffled)

    eval_count = 0 if len(shuffled) == 1 else max(1, math.ceil(len(shuffled) * eval_ratio))
    train_count = len(shuffled) - eval_count

    return shuffled[:train_count], shuffled[train_count:]


def write_jsonl(path: Path, examples: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as destination:
        for example in examples:
            destination.write(json.dumps(example, ensure_ascii=False, separators=(",", ":")) + "\n")


def main() -> None:
    args = parse_args()
    input_path = args.input if args.input.is_absolute() else PROJECT_ROOT / args.input
    train_output = args.train_output if args.train_output.is_absolute() else PROJECT_ROOT / args.train_output
    eval_output = args.eval_output if args.eval_output.is_absolute() else PROJECT_ROOT / args.eval_output

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    examples, stats = read_filtered_examples(input_path, args.min_quality)
    train_examples, eval_examples = split_examples(examples, args.eval_ratio, args.seed)

    write_jsonl(train_output, train_examples)
    write_jsonl(eval_output, eval_examples)

    print(f"Read {stats['read']} examples from {input_path.name}.")
    print(f"Kept {stats['kept']} examples with qualityRating >= {args.min_quality:g}.")
    print(f"Skipped {stats['low_quality']} low-quality or unrated examples.")
    print(f"Skipped {stats['invalid']} invalid examples.")
    print(f"Wrote {len(train_examples)} train examples to {train_output}.")
    print(f"Wrote {len(eval_examples)} eval examples to {eval_output}.")


if __name__ == "__main__":
    main()
