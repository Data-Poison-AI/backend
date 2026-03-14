import shutil
from pathlib import Path
from config import PoisonAIConfig

def remove_ai_sandbox(SOURCE_DIR):
    """Removes the models from the ai_output directory safely."""
    sandbox_models = SOURCE_DIR / "sandbox_model"
    print(sandbox_models.exists() and sandbox_models.is_dir()) #temp for debbuging
    if sandbox_models.exists() and sandbox_models.is_dir():
        shutil.rmtree(str(sandbox_models))
        print(f"deleting: {sandbox_models}")

def export_report_json(cfg : PoisonAIConfig):
    """Moves the report.zip file to backend/downloads."""
    # Solve paths
    SCRIPT_DIR = Path(__file__).parent.resolve()
    PROJECT_ROOT = SCRIPT_DIR.parents[1] # up two levels from script
    DOWNLOADS_DIR = PROJECT_ROOT / "backend" / "downloads"
    SOURCE_DIR = (PROJECT_ROOT / "ai" / cfg.output_dir).resolve()
    ARCHIVE_FORMAT = 'zip'
    #first clean sandbox to prevent downloading models
    remove_ai_sandbox(SOURCE_DIR)  #Next update can include the sandbox models to export, maybe an optional parameter to users
    filename = f"report-{cfg.timestamp}"
    temp_zip_path = SCRIPT_DIR / filename # shutil agrega la extensión solo
    
    shutil.make_archive(str(temp_zip_path), ARCHIVE_FORMAT, root_dir=str(SOURCE_DIR))
    
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
    destination = DOWNLOADS_DIR / f"{filename}.zip"
    final_zip = SCRIPT_DIR / f"{filename}.zip"
    shutil.move(str(final_zip), str(destination)) #Transform path to string for version compatibilty (the version in requirements is high enough though)
    
    print(f"Report exported to: {DOWNLOADS_DIR}")
    ## remove the reports from folder
    if(SOURCE_DIR.exists() and SOURCE_DIR.is_dir()):
        shutil.rmtree(str(SOURCE_DIR))
        print(f"Temporary output directory cleaned: {SOURCE_DIR}")