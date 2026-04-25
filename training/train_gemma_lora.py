#!/usr/bin/env python3
"""Train a Gemma LoRA adapter with QLoRA for LifeUpgrade explanations."""

from __future__ import annotations

import argparse
import inspect
import os
import sys
import types
from importlib.machinery import ModuleSpec
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_ID = "google/gemma-4-E2B-it"
DEFAULT_TRAIN_PATH = PROJECT_ROOT / "training" / "data" / "lifeupgrade_train.jsonl"
DEFAULT_EVAL_PATH = PROJECT_ROOT / "training" / "data" / "lifeupgrade_eval.jsonl"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "training" / "outputs" / "lifeupgrade-gemma-lora"
DEFAULT_CHECKPOINT_DIR = PROJECT_ROOT / "training" / "checkpoints" / "lifeupgrade-gemma-lora"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Gemma QLoRA adapter training for LifeUpgrade.")
    parser.add_argument("--train-file", type=Path, default=DEFAULT_TRAIN_PATH)
    parser.add_argument("--eval-file", type=Path, default=DEFAULT_EVAL_PATH)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--checkpoint-dir", type=Path, default=DEFAULT_CHECKPOINT_DIR)
    parser.add_argument("--max-seq-length", type=int, default=2048)
    parser.add_argument("--num-train-epochs", type=float, default=3.0)
    parser.add_argument("--per-device-train-batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--logging-steps", type=int, default=10)
    parser.add_argument("--eval-steps", type=int, default=50)
    parser.add_argument("--save-steps", type=int, default=50)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def require_training_files(train_file: Path, eval_file: Path) -> None:
    missing = [path for path in [train_file, eval_file] if not path.exists()]
    if missing:
        joined = "\n".join(f"- {path}" for path in missing)
        raise SystemExit(
            "Prepared dataset files are missing. Run `python training/prepare_dataset.py` first.\n"
            f"Missing:\n{joined}",
        )


def disable_wandb_imports() -> None:
    """Avoid broken optional W&B installs being imported by Transformers/TRL."""
    os.environ["WANDB_DISABLED"] = "true"
    os.environ["WANDB_MODE"] = "disabled"

    if "wandb" in sys.modules:
        return

    wandb_stub = types.ModuleType("wandb")
    wandb_stub.__spec__ = ModuleSpec("wandb", loader=None)
    wandb_stub.__version__ = "0.0.0"
    sys.modules["wandb"] = wandb_stub


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


def load_text_dataset(path: Path, tokenizer: Any) -> Any:
    from datasets import load_dataset

    dataset = load_dataset("json", data_files=str(path), split="train")

    def to_text(example: dict[str, Any]) -> dict[str, str]:
        return {"text": render_messages(tokenizer, example["messages"], add_generation_prompt=False)}

    return dataset.map(to_text, remove_columns=dataset.column_names)


def jsonl_has_records(path: Path) -> bool:
    with path.open("r", encoding="utf-8") as source:
        return any(line.strip() for line in source)


def supported_kwargs(callable_object: Any, values: dict[str, Any]) -> dict[str, Any]:
    signature = inspect.signature(callable_object)
    return {key: value for key, value in values.items() if key in signature.parameters}


def build_training_args(args: argparse.Namespace, bf16: bool, has_eval: bool) -> Any:
    try:
        from trl import SFTConfig

        config_class = SFTConfig
    except ImportError:
        from transformers import TrainingArguments

        config_class = TrainingArguments

    values: dict[str, Any] = {
        "output_dir": str(args.checkpoint_dir),
        "per_device_train_batch_size": args.per_device_train_batch_size,
        "gradient_accumulation_steps": args.gradient_accumulation_steps,
        "learning_rate": args.learning_rate,
        "num_train_epochs": args.num_train_epochs,
        "logging_steps": args.logging_steps,
        "save_steps": args.save_steps,
        "save_total_limit": 2,
        "warmup_ratio": 0.03,
        "lr_scheduler_type": "cosine",
        "optim": "paged_adamw_8bit",
        "bf16": bf16,
        "fp16": not bf16,
        "gradient_checkpointing": True,
        "gradient_checkpointing_kwargs": {"use_reentrant": False},
        "max_grad_norm": 0.3,
        "group_by_length": True,
        "report_to": "none",
        "seed": args.seed,
        "dataset_text_field": "text",
        "packing": False,
        "max_seq_length": args.max_seq_length,
        "max_length": args.max_seq_length,
    }

    signature = inspect.signature(config_class)
    if has_eval:
        if "eval_strategy" in signature.parameters:
            values["eval_strategy"] = "steps"
        elif "evaluation_strategy" in signature.parameters:
            values["evaluation_strategy"] = "steps"
        values["eval_steps"] = args.eval_steps

    return config_class(**supported_kwargs(config_class, values))


def build_trainer(
    model: Any,
    tokenizer: Any,
    training_args: Any,
    train_dataset: Any,
    eval_dataset: Any,
    max_seq_length: int,
) -> Any:
    from trl import SFTTrainer

    values: dict[str, Any] = {
        "model": model,
        "args": training_args,
        "train_dataset": train_dataset,
        "eval_dataset": eval_dataset,
        "processing_class": tokenizer,
        "tokenizer": tokenizer,
        "dataset_text_field": "text",
        "packing": False,
        "max_seq_length": max_seq_length,
    }
    return SFTTrainer(**supported_kwargs(SFTTrainer.__init__, values))


def main() -> None:
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    disable_wandb_imports()
    args = parse_args()
    train_file = args.train_file if args.train_file.is_absolute() else PROJECT_ROOT / args.train_file
    eval_file = args.eval_file if args.eval_file.is_absolute() else PROJECT_ROOT / args.eval_file
    output_dir = args.output_dir if args.output_dir.is_absolute() else PROJECT_ROOT / args.output_dir
    checkpoint_dir = args.checkpoint_dir if args.checkpoint_dir.is_absolute() else PROJECT_ROOT / args.checkpoint_dir
    args.output_dir = output_dir
    args.checkpoint_dir = checkpoint_dir

    require_training_files(train_file, eval_file)

    import torch
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, set_seed

    if not torch.cuda.is_available():
        raise SystemExit("QLoRA 4-bit training requires a CUDA GPU. Use a CUDA Linux/Colab runtime for training.")

    set_seed(args.seed)
    model_id = os.environ.get("GEMMA_MODEL_ID", DEFAULT_MODEL_ID)
    bf16 = torch.cuda.is_bf16_supported()
    compute_dtype = torch.bfloat16 if bf16 else torch.float16

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    train_dataset = load_text_dataset(train_file, tokenizer)
    eval_dataset = load_text_dataset(eval_file, tokenizer) if jsonl_has_records(eval_file) else None
    has_eval = eval_dataset is not None and len(eval_dataset) > 0

    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=compute_dtype,
    )

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=quantization_config,
        torch_dtype=compute_dtype,
        device_map="auto",
    )
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    training_args = build_training_args(args, bf16=bf16, has_eval=has_eval)
    trainer = build_trainer(
        model=model,
        tokenizer=tokenizer,
        training_args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset if has_eval else None,
        max_seq_length=args.max_seq_length,
    )

    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    trainer.train()
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))
    print(f"Saved LifeUpgrade Gemma LoRA adapter to {output_dir}")


if __name__ == "__main__":
    main()
