from dataclasses import dataclass, field
from typing import Optional

@dataclass
class PoisonAIConfig:
    """Central configuration for a Poison AI run."""

    # --- Data ---
    data_path: str = ""
    data_format: str = "auto"          # auto | csv | json | huggingface
    text_column: str = "text"
    label_column: Optional[str] = "label"

    # --- Model ---
    task: str = "text-classification"   # text-classification | text-generation | ner
    base_model: str = "auto"            # auto-resolved or explicit HF model id
    trust_remote_code: bool = False

    # --- Fine-tuning (sandbox) ---
    epochs: int = 3
    batch_size: int = 8
    learning_rate: float = 2e-5
    max_seq_length: int = 512
    use_lora: bool = True               # LoRA keeps it lightweight
    lora_r: int = 8
    lora_alpha: int = 16

    # --- Scanning ---
    scans: list[str] = field(default_factory=lambda: [
        "backdoor", "bias", "integrity", "drift"
    ])
    anomaly_threshold: float = 0.05     # top 5 % flagged

    # --- Reverse engineering ---
    influence_sample_size: int = 500    # How many samples to compute influence for
    activation_clusters: int = 5

    # --- Output ---
    output_dir: str = "./poison_ai_output"
    report_format: str = "json"         # json | html