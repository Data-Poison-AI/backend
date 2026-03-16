from huggingface_hub import snapshot_download

snapshot_download(
    repo_id="distilbert-base-uncased",
    local_dir="ai/models/distilbert-base-uncased"
)