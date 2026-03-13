"""
Spectral Signature Detection (Tran et al., 2018).

Idea: poisoned samples form a separable cluster in the model's
activation space. We take the top singular vector of the centred
representation matrix — poisoned points will have high scores
along this direction.
"""

import numpy as np
import torch
from sklearn.cluster import KMeans


@torch.no_grad()
def get_representations(model, tokenizer, texts, max_len):
    """Extract last-hidden-state CLS vectors."""
    model.eval()
    reps = []
    for text in texts:
        inputs = tokenizer(text, return_tensors="pt",
                           truncation=True, max_length=max_len)
        inputs = {k: v.to(model.device) for k, v in inputs.items()}
        out = model(**inputs, output_hidden_states=True)
        cls = out.hidden_states[-1][:, 0, :].cpu().numpy().flatten()
        reps.append(cls)
    return np.stack(reps)


def spectral_signature_scores(reps: np.ndarray) -> np.ndarray:
    """
    Return per-sample outlier score based on top singular vector.
    Higher score → more likely poisoned.
    """
    centred = reps - reps.mean(axis=0)
    _, S, Vt = np.linalg.svd(centred, full_matrices=False)
    top_v = Vt[0]                                  # top right singular vector
    scores = (centred @ top_v) ** 2                # squared projection
    return scores
