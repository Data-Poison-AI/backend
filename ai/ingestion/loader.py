import json, csv, pathlib
from datasets import load_dataset, Dataset

def load_data(path: str, fmt: str = "auto", **kwargs) -> Dataset:
    """Unified loader that returns a HuggingFace Dataset."""

    p = pathlib.Path(path)

    if fmt == "auto":
        fmt = p.suffix.lstrip(".")

    match fmt:
        case "csv":
            return load_dataset("csv", data_files=str(p), split="train")
        case "json" | "jsonl":
            return load_dataset("json", data_files=str(p), split="train")
        case "parquet":
            return load_dataset("parquet", data_files=str(p), split="train")
        case _:
            # Assume it's a HuggingFace dataset identifier
            return load_dataset(path, split="train")