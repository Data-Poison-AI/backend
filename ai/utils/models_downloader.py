from huggingface_hub import snapshot_download
# Download each model individually

snapshot_download(
    repo_id="distilgpt2",
    local_dir="./models/ditilgpt2/"
)
snapshot_download(
    repo_id="distilbert-base-uncased",
    local_dir="./models/distilbert-base-uncased/"
)
snapshot_download(
    repo_id="facebook/bart-base",
    local_dir="./models/facebook_bart-base/"
)
