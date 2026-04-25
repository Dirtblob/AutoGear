# LifeUpgrade Gemma LoRA Training

This folder prepares LifeUpgrade explanation examples for a Gemma LoRA/QLoRA fine-tune. It trains an adapter only, not a full model.

## Safety

- Do not paste a Hugging Face token into source code.
- Do not commit tokens, prepared JSONL data, checkpoints, or adapter outputs.
- `.gitignore` excludes `.env`, `training/data/*.jsonl`, `training/checkpoints/*`, and `training/outputs/*`.
- Prefer `huggingface-cli login`. If you use an environment variable, export it only in your shell session.

## 1. Hugging Face Access

Create a read token from Hugging Face:

1. Open your Hugging Face account settings.
2. Go to Access Tokens.
3. Create a token with read access.

Log in interactively:

```bash
huggingface-cli login
```

Then accept the Gemma model terms on the Hugging Face model page for the model you plan to train. The default model is:

```bash
google/gemma-4-E2B-it
```

You can override it for both training and testing:

```bash
export GEMMA_MODEL_ID=google/gemma-4-E2B-it
```

## 2. Install Dependencies

QLoRA 4-bit training needs a CUDA GPU runtime. On a Mac, use a CUDA Linux machine, cloud GPU, or Colab for the actual training run.

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install "torch>=2.3" "transformers>=4.45" "datasets>=2.20" "accelerate>=0.34" "peft>=0.12" "trl>=0.10" "bitsandbytes>=0.43" "huggingface_hub>=0.24" sentencepiece protobuf
```

If your CUDA setup needs a specific PyTorch wheel, install PyTorch from the official PyTorch selector first, then install the remaining packages.

## 3. Prepare Dataset

Put the downloaded file at the project root:

```bash
lifeupgrade-training-data-quality-rated.jsonl
```

Prepare train/eval files:

```bash
python training/prepare_dataset.py
```

The script:

- keeps only examples with `qualityRating >= 4`
- writes only `{"messages": [...]}`
- shuffles deterministically
- writes `training/data/lifeupgrade_train.jsonl`
- writes `training/data/lifeupgrade_eval.jsonl`

## 4. Train Adapter

Do not start this unless you are ready to run GPU training.

```bash
python training/train_gemma_lora.py
```

The script uses:

- default model from `GEMMA_MODEL_ID` or `google/gemma-4-E2B-it`
- Transformers
- TRL `SFTTrainer`
- PEFT LoRA
- bitsandbytes 4-bit NF4 quantization

Final adapter output:

```bash
training/outputs/lifeupgrade-gemma-lora
```

Intermediate checkpoints:

```bash
training/checkpoints/lifeupgrade-gemma-lora
```

## 5. Test Adapter

After training:

```bash
python training/test_adapter.py
```

The test script loads the base model plus the LoRA adapter and prints the generated explanation JSON for one LifeUpgrade prompt.

For a non-CUDA smoke test, you can try:

```bash
python training/test_adapter.py --no-4bit
```

That can be much slower and may require more memory.
