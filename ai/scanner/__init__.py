from .backdoor_scan import BackdoorScan
from .integrity_scan import IntegrityScan
from .drift_scan import DriftScan

SCAN_REGISTRY = {
    "backdoor":  BackdoorScan,
    "integrity": IntegrityScan,
    "drift":     DriftScan,
}

def run_all_scans(scan_names, model, tokenizer, dataset, train_losses, cfg):
    all_findings = []
    for name in scan_names:
        scanner = SCAN_REGISTRY[name]()
        print(f"  ⏳ Running scan: {scanner.name}")
        results = scanner.run(model, tokenizer, dataset, train_losses, cfg)
        all_findings.extend(results)
        for f in results:
            print(f"    [{f.severity.upper()}] {f.description}")
    return all_findings