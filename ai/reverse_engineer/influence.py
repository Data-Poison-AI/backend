"""
Simplified Influence Functions (Koh & Liang, 2017).

Full influence functions require Hessians — expensive.
We use the *TracIn* approximation (Pruthi et al., 2020):
   influence(z_test, z_train) ≈ Σ_t η_t · ∇L(z_test)ᵀ · ∇L(z_train)
   summed over checkpoints t with learning rate η_t.

This tells us: "which training sample, if removed, would most change
the model's behaviour on a suspicious probe?"
"""

import torch
import numpy as np
from pathlib import Path
from transformers import AutoModelForSequenceClassification, AutoTokenizer


def compute_sample_gradient(model, tokenizer, text, label, max_len):
    """Return the flattened gradient of the loss w.r.t. model params."""
    model.zero_grad()
    inputs = tokenizer(text, return_tensors="pt",
                       truncation=True, max_length=max_len)
    inputs = {k: v.to(model.device) for k, v in inputs.items()}
    inputs["labels"] = torch.tensor([label]).to(model.device)
    loss = model(**inputs).loss
    loss.backward()

    grads = []
    for p in model.parameters():
        if p.grad is not None:
            grads.append(p.grad.flatten())
    return torch.cat(grads)


def tracin_influence(
    checkpoint_dirs: list[Path],
    tokenizer: AutoTokenizer,
    probe_text: str,
    probe_label: int,
    train_texts: list[str],
    train_labels: list[int],
    max_len: int,
    lr: float,
    sample_size: int = 200,
) -> np.ndarray:
    """
    For a given suspicious probe sample, compute TracIn influence
    scores for each training sample across saved checkpoints.
    Returns array of shape (len(train_texts),).
    """
    # Sub-sample for speed
    indices = np.random.choice(len(train_texts), min(sample_size, len(train_texts)),
                                replace=False)
    influence_scores = np.zeros(len(train_texts))

    for ckpt_dir in checkpoint_dirs:
        model = AutoModelForSequenceClassification.from_pretrained(ckpt_dir)
        model.eval()

        grad_probe = compute_sample_gradient(
            model, tokenizer, probe_text, probe_label, max_len
        )

        for idx in indices:
            grad_train = compute_sample_gradient(
                model, tokenizer, train_texts[idx], train_labels[idx], max_len
            )
            influence_scores[idx] += lr * torch.dot(grad_probe, grad_train).item()

        del model

    return influence_scores