import json
from pathlib import Path
from datetime import datetime
import numpy as np
from scanner.base_scan import ScanFinding
from config import PoisonAIConfig


def generate_report(
    cfg: PoisonAIConfig,
    findings: list[ScanFinding],
    suspicion_scores: np.ndarray,
    data_stats: dict,
    output_dir: str,
):
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    report = {
        "generated_at": datetime.utcnow().isoformat(),
        "config": {
            "model": cfg.base_model,
            "task": cfg.task,
            "epochs": cfg.epochs,
        },
        "data_stats": data_stats,
        "total_samples": len(suspicion_scores),
        "flagged_samples": int((suspicion_scores >= 0.7).sum()),
        "scan_findings": [
            {
                "scan": f.scan_name,
                "severity": f.severity,
                "description": f.description,
                "affected_count": len(f.affected_indices),
                "confidence": f.confidence,
            }
            for f in findings
        ],
        "top_suspicious_indices": (
            np.argsort(suspicion_scores)[::-1][:20].tolist()
        ),
    }

    report_path = out / "report.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(f"\n📄 Report saved to {report_path}")
    return report