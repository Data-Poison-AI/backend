"""
Orchestrator: combine multiple signals to rank every training
sample by its 'suspicion score'.
"""
import numpy as np
from config import PoisonAIConfig
from scanner.base_scan import ScanFinding


def compute_suspicion_scores(
    findings: list[ScanFinding],
    dataset_size: int,
    spectral_scores: np.ndarray | None = None,
    influence_scores: np.ndarray | None = None,
) -> np.ndarray:
    """
    Fuse all signals into a single per-sample suspicion score ∈ [0, 1].
    """
    scores = np.zeros(dataset_size, dtype=np.float64)

    # --- weight from scanner findings ---
    severity_weight = {"critical": 1.0, "high": 0.8, "medium": 0.5, "low": 0.2}
    for f in findings:
        w = severity_weight.get(f.severity, 0.3) * f.confidence
        for idx in f.affected_indices:
            if idx < dataset_size:
                scores[idx] += w

    # --- spectral signature ---
    if spectral_scores is not None:
        normed = spectral_scores / (spectral_scores.max() + 1e-9)
        scores += normed * 0.6

    # --- influence function ---
    if influence_scores is not None:
        normed = influence_scores / (np.abs(influence_scores).max() + 1e-9)
        scores += normed * 0.8

    # Normalise to [0, 1]
    scores = (scores - scores.min()) / (scores.max() - scores.min() + 1e-9)
    return scores