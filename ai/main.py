"""
Poison AI — CLI entrypoint.

Usage:
    python main.py --data ./my_data.csv --task text-classification
"""

import argparse
from pathlib import Path

from config import PoisonAIConfig, UPLOADS_DIR  #imports config and uploads directory
from ingestion.loader import load_data
from ingestion.validator import validate
from sandbox.model_registry import resolve_model
from sandbox.fine_tuner import SandboxFineTuner
from scanner import run_all_scans
from reverse_engineer.activation import get_representations, spectral_signature_scores
from reverse_engineer.tracer import compute_suspicion_scores
from report.generator import generate_report
from report.cleaner import clean_dataset
from report.exporter import export_report_json #exporter to transform into .zip

from transformers import AutoModelForSequenceClassification, AutoTokenizer


def main():
    parser = argparse.ArgumentParser(description="Poison AI")
    parser.add_argument("--data",  required=True, help="Dataset filename or path")
    parser.add_argument("--task",  default="text-classification")
    parser.add_argument("--model", default="auto")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--threshold", type=float, default=0.7,
                        help="Suspicion score threshold for flagging")
    parser.add_argument("--output", default="./poison_ai_output")
    parser.add_argument("--text-column", default="text")
    parser.add_argument("--label-column", default="label")
    args = parser.parse_args()

    model_path = resolve_model(args.task, args.model)
    # ── 1. Configure ──────────────────────────────────────
    cfg = PoisonAIConfig(
        data_path=args.data,
        task=args.task,
        base_model=model_path,
        epochs=args.epochs,
        output_dir=args.output,
        text_column=args.text_column,
        label_column=args.label_column
    )
    if not Path(cfg.data_path).exists():
        print(f"❌  Error: Dataset not found!")
        print(f"    Looked for: {args.data}")
        print(f"    Resolved to: {cfg.data_path}")
        print(f"    Uploads directory: {UPLOADS_DIR}")
        print(f"\n      Available files in uploads:")
        if UPLOADS_DIR.exists():
            for f in UPLOADS_DIR.iterdir():
                print(f"      - {f.name}")
        return

    print(f"✅  Using dataset: {cfg.data_path}")
    print(f"    Poison AI — analysing: {cfg.data_path}")
    print(f"    Model : {cfg.base_model}")
    print(f"    Task  : {cfg.task}\n")

    # ── 2. Ingest & validate ──────────────────────────────
    try:
        dataset = load_data(cfg.data_path)
    except Exception as e:
        print(f"❌ Error loading dataset: {e}. Check if the file format is supported.")
        return

    # Auto-detect columns if missing, to prevent crashing on random test files
    if cfg.text_column not in dataset.column_names and len(dataset.column_names) > 0:
        print(f"⚠️ Text column '{cfg.text_column}' not found. Auto-selecting '{dataset.column_names[0]}'")
        cfg.text_column = dataset.column_names[0]
        
    if cfg.label_column and cfg.label_column not in dataset.column_names:
        if len(dataset.column_names) > 1:
            print(f"⚠️ Label column '{cfg.label_column}' not found. Auto-selecting '{dataset.column_names[-1]}'")
            cfg.label_column = dataset.column_names[-1]
        else:
            cfg.label_column = None

    stats   = validate(dataset, cfg.text_column, cfg.label_column)
    print(f"📊 Data stats: {stats}\n")

    num_labels = len(set(dataset[cfg.label_column])) if cfg.label_column else 2

    # ── 3. Sandboxed fine-tuning ──────────────────────────
    print("🔬 Fine-tuning in sandbox …")
    ft = SandboxFineTuner(cfg, dataset, num_labels)
    finetuned_model_path = ft.run()
    print(f"   ✅ Model saved: {finetuned_model_path}\n")

    # ── 4. Load fine-tuned model for scanning ─────────────
    model     = AutoModelForSequenceClassification.from_pretrained(
        finetuned_model_path,
        output_hidden_states=True
    )
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
    clean_path   = Path(cfg.output_dir) / f"clean_data-{cfg.timestamp}.json"
    flagged_path = Path(cfg.output_dir) / f"flagged_data-{cfg.timestamp}.json"
    clean_ds.to_json(clean_path)
    flagged_ds.to_json(flagged_path)

    print(f"\n✅ Done!")
    print(f"   Clean samples  : {len(clean_ds):,}  → {clean_path}")
    print(f"   Flagged samples: {len(flagged_ds):,}  → {flagged_path}")
    print(f"   Report         : {Path(cfg.output_dir) / 'report.json'}")
    #remove fine-tunned ai models and export
    export_report_json(cfg)

if __name__ == "__main__":
    main()