from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class ScanFinding:
    scan_name: str
    severity: str            # low | medium | high | critical
    description: str
    affected_indices: list[int]   # rows in the training data
    confidence: float             # 0-1
    metadata: dict = None

class BaseScan(ABC):
    name: str = "base"

    @abstractmethod
    def run(self, model, tokenizer, dataset, train_losses, cfg) -> list[ScanFinding]:
        ...