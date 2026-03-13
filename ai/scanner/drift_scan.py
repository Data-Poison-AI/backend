import numpy as np
import torch
from sklearn.ensemble import IsolationForest
from .base_scan import BaseScan, ScanFinding

class DriftScan(BaseScan):
    """
    Use the fine-tuned model's hidden representations to find
    embedding-space outliers via Isolation Forest.
    """
    name = "drift"

    @torch.no_grad()
    def _get_embeddings(self, model, tokenizer, texts, max_len):
        model.eval()
        embeddings = []
        for text in texts:
            inputs = tokenizer(text, return_tensors="pt",
                               truncation=True, max_length=max_len)
            inputs = {k: v.to(model.device) for k, v in inputs.items()}
            outputs = model(**inputs, output_hidden_states=True)
            cls_emb = outputs.hidden_states[-1][:, 0, :]  # CLS token
            embeddings.append(cls_emb.cpu().numpy().flatten())
        return np.stack(embeddings)

    def run(self, model, tokenizer, dataset, train_losses, cfg) -> list[ScanFinding]:
        findings = []
        texts = dataset[cfg.text_column]

        embs = self._get_embeddings(model, tokenizer, texts, cfg.max_seq_length)

        iso = IsolationForest(contamination=cfg.anomaly_threshold, random_state=42)
        preds = iso.fit_predict(embs)                     # -1 = outlier

        outlier_idx = np.where(preds == -1)[0].tolist()

        if outlier_idx:
            findings.append(ScanFinding(
                scan_name=self.name,
                severity="medium",
                description=(
                    f"{len(outlier_idx)} samples are embedding-space outliers — "
                    f"may be distribution-shifted or adversarial."
                ),
                affected_indices=outlier_idx,
                confidence=0.55,
            ))
        return findings