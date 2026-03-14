from datasets import Dataset

class ValidationError(Exception): ...

def validate(dataset: Dataset, text_col: str, label_col: str | None):
    """Basic sanity checks before we send data to the sandbox."""

    if text_col not in dataset.column_names:
        raise ValidationError(f"Text column '{text_col}' not found. "
                              f"Available: {dataset.column_names}")

    if label_col and label_col not in dataset.column_names:
        raise ValidationError(f"Label column '{label_col}' not found.")

    # Flag obvious issues early
    stats = {
        "total_rows": len(dataset),
        "empty_text_rows": sum(1 for t in dataset[text_col] if not str(t).strip()),
        "duplicate_rows": len(dataset) - len(set(dataset[text_col])),
    }

    if label_col:
        from collections import Counter
        label_dist = Counter(dataset[label_col])
        stats["label_distribution"] = dict(label_dist)

    return stats