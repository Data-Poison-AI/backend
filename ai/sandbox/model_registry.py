"""Map a task description to a reasonable free HF base model."""

TASK_MODEL_MAP = {
    "text-classification": "distilbert-base-uncased",
    "text-generation":     "distilgpt2",
    "ner":                 "distilbert-base-uncased",
    "sentiment":           "distilbert-base-uncased",
    "summarization":       "facebook/bart-base",
}

def resolve_model(task: str, explicit: str | None = None) -> str:
    if explicit and explicit != "auto":
        return explicit
    return TASK_MODEL_MAP.get(task, "distilbert-base-uncased")