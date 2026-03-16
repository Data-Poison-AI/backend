import shutil
from pathlib import Path
from config import PoisonAIConfig

def remove_ai_sandbox(SOURCE_DIR):
    """Removes the models from the ai_output directory safely."""
    sandbox_models = SOURCE_DIR / "sandbox_model"
    if sandbox_models.exists() and sandbox_models.is_dir():
        shutil.rmtree(str(sandbox_models))

def export_report_json(cfg: PoisonAIConfig):
    """Prepares the poison_ai_output folder for zipping by the backend."""
    SCRIPT_DIR = Path(__file__).parent.resolve()
    PROJECT_ROOT = SCRIPT_DIR.parents[1]
    SOURCE_DIR = (PROJECT_ROOT / "ai" / cfg.output_dir).resolve()
    
    # Just clean up the sandbox model to save space. 
    # NodeJS will zip the entire SOURCE_DIR and send it.
    remove_ai_sandbox(SOURCE_DIR)
    
    print(f"Prepared output folder for backend: {SOURCE_DIR}")