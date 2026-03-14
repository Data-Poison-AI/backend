import numpy as np
from datasets import Dataset

def clean_dataset(
    dataset: Dataset,
    suspicion_scores: np.ndarray,
    threshold: float = 0.7,
) -> tuple[Dataset, Dataset]:
    """
    Split the dataset into clean and flagged portions.
    Returns (clean_dataset, flagged_dataset).
    """
    flagged_mask = suspicion_scores >= threshold
    flagged_idx  = np.where(flagged_mask)[0].tolist()
    clean_idx    = np.where(~flagged_mask)[0].tolist()

    return dataset.select(clean_idx), dataset.select(flagged_idx)