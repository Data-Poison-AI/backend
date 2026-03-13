"""
Poison AI — CLI entrypoint.

Usage:
    python main.py --data ./my_data.csv --task text-classification
"""

import argparse
from pathlib import Path

from config import PoisonAIConfig
from ingestion.loader import load_data
from ingestion.validator import validate
from sandbox.model_registry import resolve_model
from sandbox.fine_tuner import SandboxFineTuner
from scanner import run_all_scans
from reverse_engineer.activation import get_representations, spectral_signature_scores
from reverse_engineer.tracer import compute_suspicion_scores
from report.generator import generate_report
from report.cleaner import clean_dataset

from transformers import AutoModelForSequenceClassification, AutoTokenizer


def main():
    parser = argparse.ArgumentParser(description="Poison AI")
    parser.add_argument("--data",  required=True, help="Path to training data")
    parser.add_argument("--task",  default="text-classification")
    parser.add_argument("--model", default="auto")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--threshold", type=float, default=0.7,
                        help="Suspicion score threshold for flagging")
    parser.add_argument("--output", default="./poison_ai_output")
    args = parser.parse_args()

    # ── 1. Configure ──────────────────────────────────────
    cfg = PoisonAIConfig(
        data_path=args.data,
        task=args.task,
        base_model=resolve_model(args.task, args.model),
        epochs=args.epochs,
        output_dir=args.output,
    )
    print(f"🧪 Poison AI — analysing: {cfg.data_path}")
    print(f"   Model : {cfg.base_model}")
    print(f"   Task  : {cfg.task}\n")

    # ── 2. Ingest & validate ──────────────────────────────
    dataset = load_data(cfg.data_path)
    stats   = validate(dataset, cfg.text_column, cfg.label_column)
    print(f"📊 Data stats: {stats}\n")

    num_labels = len(set(dataset[cfg.label_column])) if cfg.label_column else 2

    # ── 3. Sandboxed fine-tuning ──────────────────────────
    print("🔬 Fine-tuning in sandbox …")
    ft = SandboxFineTuner(cfg, dataset, num_labels)
    model_path = ft.run()
    print(f"   ✅ Model saved: {model_path}\n")

    # ── 4. Load fine-tuned model for scanning ─────────────
    model     = AutoModelForSequenceClassification.from_pretrained(model_path,
                    output_hidden_states=True)
    tokenizer = AutoTokenizer.from_pretrained(cfg.base_model)

    # ── 5. Run vulnerability scans ────────────────────────
    print("🔍 Scanning for vulnerabilities …")
    findings = run_all_scans(
        cfg.scans, model, tokenizer, dataset,
        ft.training_losses_per_sample, cfg,
    )

    # ── 6. Reverse-engineer: spectral signatures ─────────
    print("\n🧬 Computing spectral signatures …")
    reps     = get_representations(model, tokenizer,
                                   dataset[cfg.text_column], cfg.max_seq_length)
    spec_scores = spectral_signature_scores(reps)

    # ── 7. Fuse into suspicion scores ─────────────────────
    suspicion = compute_suspicion_scores(
        findings, len(dataset),
        spectral_scores=spec_scores,
    )

    # ── 8. Report & clean ─────────────────────────────────
    report = generate_report(cfg, findings, suspicion, stats, cfg.output_dir)
    clean_ds, flagged_ds = clean_dataset(dataset, suspicion, args.threshold)

    clean_path   = Path(cfg.output_dir) / "clean_data.json"
    flagged_path = Path(cfg.output_dir) / "flagged_data.json"
    clean_ds.to_json(clean_path)
    flagged_ds.to_json(flagged_path)

    print(f"\n✅ Done!")
    print(f"   Clean samples  : {len(clean_ds):,}  → {clean_path}")
    print(f"   Flagged samples: {len(flagged_ds):,}  → {flagged_path}")
    print(f"   Report         : {Path(cfg.output_dir) / 'report.json'}")


if __name__ == "__main__":
    main()