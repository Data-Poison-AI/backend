import numpy as np
from .base_scan import BaseScan, ScanFinding

class IntegrityScan(BaseScan):
    """
    Detect mislabeled or label-flipped samples.

    Core idea: if a sample's loss is *consistently* high across all epochs,
    the model "disagrees" with its label — it is likely mislabeled.
    """
    name = "integrity"

    def run(self, model, tokenizer, dataset, train_losses, cfg) -> list[ScanFinding]:
        findings = []
        if not train_losses:
            return findings

        all_losses = np.array(train_losses)
        mean_loss  = np.mean(all_losses, axis=0)

        # High-loss outliers → likely mislabeled
        threshold = np.percentile(mean_loss, 100 - (cfg.anomaly_threshold * 100))
        bad_indices = np.where(mean_loss > threshold)[0].tolist()

        if bad_indices:
            findings.append(ScanFinding(
                scan_name=self.name,
                severity="high",
                description=(
                    f"{len(bad_indices)} samples had persistently high loss — "
                    f"likely mislabeled or corrupted."
                ),
                affected_indices=bad_indices,
                confidence=0.70,
            ))

        return findings