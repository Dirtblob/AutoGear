#!/usr/bin/env python3
"""Load the LifeUpgrade Gemma LoRA adapter and print one explanation JSON."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_ID = "google/gemma-4-E2B-it"
DEFAULT_ADAPTER_DIR = PROJECT_ROOT / "training" / "outputs" / "lifeupgrade-gemma-lora"

SYSTEM_PROMPT = (
    "You are LifeUpgrade's explanation engine. Explain deterministic recommendations without changing scores, "
    "prices, specs, or availability."
)

SAMPLE_INPUT = {
    "userProfileSummary": "Remote product designer, balanced spender, budget $450, reports neck pain and eye strain.",
    "inventorySummary": "Uses a laptop on a 48-inch desk with no external monitor or laptop stand.",
    "categoryRecommendation": {
        "category": "monitor",
        "score": 88,
        "priority": "high",
        "reasons": ["Directly addresses eye strain", "Improves posture when paired with better desk ergonomics"],
    },
    "recommendation": {
        "product": {
            "name": "Dell S2722QC",
            "brand": "Dell",
            "category": "monitor",
            "priceUsd": 299,
            "shortDescription": "27-inch 4K USB-C monitor",
        },
        "score": 91,
        "fit": "excellent",
        "reasons": ["Sharp 4K panel", "USB-C simplifies the desk setup", "Fits the stated budget"],
        "tradeoffs": ["Takes permanent desk space"],
        "whyNotCheaper": "Cheaper displays usually give up USB-C or panel sharpness.",
        "whyNotMoreExpensive": "Higher-end monitors add polish, but not enough extra relief for this budget.",
        "availabilityStatus": "mock_available",
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test the trained LifeUpgrade Gemma LoRA adapter.")
    parser.add_argument("--adapter-dir", type=Path, default=DEFAULT_ADAPTER_DIR)
    parser.add_argument("--max-new-tokens", type=int, default=512)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--top-p", type=float, default=0.9)
    parser.add_argument("--no-4bit", action="store_true", help="Load without 4-bit quantization.")
    return parser.parse_args()


def collapse_system_messages(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    system_messages = [message["content"].strip() for message in messages if message.get("role") == "system"]
    chat_messages = [
        {"role": message["role"], "content": message["content"].strip()}
        for message in messages
        if message.get("role") != "system"
    ]

    if not system_messages:
        return chat_messages

    system_prefix = "System instruction:\n" + "\n\n".join(system_messages)
    for message in chat_messages:
        if message["role"] == "user":
            message["content"] = f"{system_prefix}\n\nUser request:\n{message['content']}"
            return chat_messages

    return [{"role": "user", "content": system_prefix}, *chat_messages]


def fallback_chat_template(messages: list[dict[str, str]], add_generation_prompt: bool) -> str:
    rendered = []
    for message in messages:
        role = "model" if message["role"] == "assistant" else message["role"]
        rendered.append(f"<start_of_turn>{role}\n{message['content']}<end_of_turn>\n")
    if add_generation_prompt:
        rendered.append("<start_of_turn>model\n")
    return "".join(rendered)


def render_messages(tokenizer: Any, messages: list[dict[str, str]], add_generation_prompt: bool = False) -> str:
    gemma_messages = collapse_system_messages(messages)
    if getattr(tokenizer, "chat_template", None):
        return tokenizer.apply_chat_template(
            gemma_messages,
            tokenize=False,
            add_generation_prompt=add_generation_prompt,
        )
    return fallback_chat_template(gemma_messages, add_generation_prompt=add_generation_prompt)


def build_test_messages() -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "Use this LifeUpgrade recommendation input and return only valid JSON with keys "
                "explanation, reasons, tradeoffs, whyNotCheaper, whyNotMoreExpensive.\n\n"
                f"{json.dumps(SAMPLE_INPUT, indent=2)}"
            ),
        },
    ]


def extract_json_object(text: str) -> Any:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.startswith("json"):
            stripped = stripped[4:].strip()

    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(stripped[start : end + 1])
        except json.JSONDecodeError:
            pass

    return {"rawOutput": text}


def main() -> None:
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    os.environ.setdefault("WANDB_DISABLED", "true")
    os.environ.setdefault("WANDB_MODE", "disabled")
    args = parse_args()
    adapter_dir = args.adapter_dir if args.adapter_dir.is_absolute() else PROJECT_ROOT / args.adapter_dir
    if not adapter_dir.exists():
        raise SystemExit(f"Adapter not found at {adapter_dir}. Train first with training/train_gemma_lora.py.")

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    model_id = os.environ.get("GEMMA_MODEL_ID", DEFAULT_MODEL_ID)
    load_in_4bit = not args.no_4bit
    if load_in_4bit and not torch.cuda.is_available():
        raise SystemExit("4-bit adapter testing requires CUDA. Re-run with --no-4bit for a non-CUDA smoke test.")

    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    compute_dtype = torch.bfloat16 if bf16 else torch.float16
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model_kwargs: dict[str, Any] = {"torch_dtype": compute_dtype, "device_map": "auto"}
    if load_in_4bit:
        model_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=compute_dtype,
        )

    base_model = AutoModelForCausalLM.from_pretrained(model_id, **model_kwargs)
    model = PeftModel.from_pretrained(base_model, str(adapter_dir))
    model.eval()

    prompt = render_messages(tokenizer, build_test_messages(), add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt")
    first_device = next(model.parameters()).device
    inputs = {key: value.to(first_device) for key, value in inputs.items()}

    with torch.no_grad():
        output_ids = model.generate(
            **inputs,
            max_new_tokens=args.max_new_tokens,
            do_sample=args.temperature > 0,
            temperature=args.temperature,
            top_p=args.top_p,
            pad_token_id=tokenizer.eos_token_id,
        )

    generated_ids = output_ids[0][inputs["input_ids"].shape[-1] :]
    generated_text = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
    print(json.dumps(extract_json_object(generated_text), indent=2))


if __name__ == "__main__":
    main()
