import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from pathlib import Path
# Get directories
CONFIG_DIR = Path(__file__).parent.resolve() # Gets utils parent -> ai
PROJECT_ROOT = CONFIG_DIR.parent
UPLOADS_DIR = PROJECT_ROOT / "backend" / "uploads"

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
        "backdoor", "integrity", "drift"
    ])
    anomaly_threshold: float = 0.05     # top 5 % flagged

    # --- Reverse engineering ---
    influence_sample_size: int = 500    # How many samples to compute influence for
    activation_clusters: int = 5

    # --- Output ---.
    timestamp : str = field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    )
    output_dir: Optional[str] = None    # dinamically generated to create output per instance (user peitition) -> can be fetched from express
    report_format: str = "json"         # json | html

    def __post_init__(self):
        """Resolve dta_path relative to uploads directory"""
        if not self.output_dir:
            self.output_dir = f".poison_ai_output_{self.timestamp}_{uuid.uuid4().hex[:4]}" #creates haxe to ensure uniqueness even at the same second
        if self.data_path:
            self.data_path = self._resolve_data_path(self.data_path)
    def _resolve_data_path(self, path: str)-> str:
        """
        Resolve data path with smart lookup:
        1. If absodule path -> use as-is
        2. If exists relative to CWD -> use as-is
        3. Otherwise -> look in uploads directory
        """
        path_obj = Path(path)
        if path_obj.is_absolute():
            return str(path_obj)

        # Case 2: Exists relative to current working directory
        if path_obj.exists():
            return str(path_obj.resolve())

        # Case 3: Look in uploads directory
        uploads_path = UPLOADS_DIR / path_obj.name  # Use just filename
        if uploads_path.exists():
            return str(uploads_path)

        # Case 4: Try full relative path in uploads
        uploads_path_full = UPLOADS_DIR / path_obj
        if uploads_path_full.exists():
            return str(uploads_path_full)

        # Not found anywhere - return uploads path (will error later with clear message)
        return str(UPLOADS_DIR / path_obj.name) #If working along with express, only this one should be executed