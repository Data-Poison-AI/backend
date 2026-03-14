from pathlib import Path
"""Map a task description to a reasonable free HF base model."""
LOCAL_MODEL_DIR = Path(__file__).parent.parent / "models" #ai/models

TASK_MODEL_MAP = {
    "text-classification": "distilbert-base-uncased",
    "text-generation":     "distilgpt2",
    "ner":                 "distilbert-base-uncased",
    "sentiment":           "distilbert-base-uncased",
    "summarization":       "facebook/bart-base",
}

def resolve_model(task: str, explicit: str | None = None) -> str:
    """
    Resolver model ID to:
    1. Local path (if exists in ai/models/)
    2. Original HF model IF (if not found)
    """
    if explicit and explicit != "auto":
        model_id = explicit
    else: 
        model_id = TASK_MODEL_MAP.get(task, "distilbert-base-uncased")
    # Convert HF model to local directory name ("/" are replaced for "_")
    local_model_name = model_id.replace("/", "_")
    local_path = LOCAL_MODEL_DIR / local_model_name
    # Check if local model exists
    if local_path.exists():
        print(f"✅ Using local model: {local_path}")
        return str(local_path)
    #Fall back to HF model ID
    print(f"⚠️ Local model not found for '{model_id}'. Using HF Hub, it may fail to fecth")
    return str(model_id)