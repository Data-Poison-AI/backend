# AI Modules

The AI modules in Poison AI are responsible for analyzing machine learning datasets and detecting potential data poisoning attacks, corrupted samples, and abnormal patterns that could compromise model behavior.

These modules work together inside a modular pipeline where each component performs a specific task in the detection and analysis process. The system combines training dynamics, statistical analysis, and representation learning techniques to identify suspicious data.

The AI modules are located mainly in the following components:

- sandbox/
- scanner/
- reverse_engineer/

Each module contributes to detecting vulnerabilities from a different perspective.

## Sandbox Training Module

The sandbox module is responsible for training a temporary model using the provided dataset.
This model is not intended for production use; instead, it is used to analyze how the data affects the training process.

The key goal of this module is to capture training behavior that may reveal poisoned samples.

### Main Responsibilities

- Fine-tuning a model using the dataset

- Tracking training losses for each sample

- Saving checkpoints for later analysis

- Running training in an isolated environment

### Core Component
sandbox/fine_tuner.py

### Technique Used

The sandbox uses LoRA (Low-Rank Adaptation) to efficiently fine-tune models with fewer parameters.

This allows the system to train models quickly while still capturing useful training dynamics.

### Output

The module produces:

- a trained model

- per-sample training loss history

- model checkpoints used for later analysis

These outputs are used by the detection modules.

## Vulnerability Scanner Modules

The scanner modules perform the main detection tasks.
Each scanner implements a different technique to identify suspicious behavior in the dataset.

The scanners share a common interface defined in:

```scanner/base_scan.py```

Each scanner returns a list of ScanFinding objects that describe detected vulnerabilities.

## Backdoor Detection Module

The BackdoorScan module detects hidden triggers embedded inside training data.

Backdoor attacks insert special patterns into the dataset so that the model learns to produce a specific output whenever the trigger appears.

File
```scanner/backdoor_scan.py```

### Detection Methods

The module uses two main signals.

### Token-label correlation

The system checks whether certain tokens appear almost exclusively with a specific label.
If a token has extremely high correlation with one label, it may indicate a hidden trigger.

Example:

```token: "cf"
label distribution: 99% positive```

Such strong correlations are unusual in natural language and may indicate a backdoor.

### Loss trajectory analysis

During sandbox training, the system records the loss for each sample.

Backdoor samples often show unusually low loss, because the model quickly learns the shortcut created by the trigger.

### Output

The module reports:

- suspicious tokens

- affected dataset samples

- severity level

- confidence score

- Data Integrity Detection Module

The IntegrityScan module identifies mislabeled or corrupted samples in the dataset.

File
```scanner/integrity_scan.py```

### Detection Strategy

The system analyzes training losses recorded during sandbox training.

If a sample consistently produces very high loss values, it means the model strongly disagrees with its label.

This often indicates:

- label flipping attacks

- annotation mistakes

- corrupted samples

- Detection Logic

The module calculates the average loss for each sample and flags those in the top percentile of highest losses.

### Output

The module returns:

- indices of suspicious samples

- severity level

- confidence score

## Distribution Drift Detection Module

The DriftScan module detects samples that do not match the general distribution of the dataset.

File
```scanner/drift_scan.py```

### Detection Strategy

The module extracts embedding representations from the trained model and applies anomaly detection.

Technique Used

Isolation Forest is used to identify outliers in the embedding space.

The process is:

- extract text embeddings from the model

- build a feature space representation

- apply Isolation Forest to detect anomalies

Samples that are easily isolated in the feature space are flagged as suspicious.

## Output

The module reports:

- outlier samples

- anomaly scores

- detection confidence

## Reverse Engineering Module

The reverse_engineer module investigates why certain samples were flagged as suspicious.

This module attempts to identify which training samples influenced the model’s behavior.

Files involved:

``` 
reverse_engineer/influence.py
reverse_engineer/activation.py
reverse_engineer/tracer.py
```
## Influence Analysis Module

The influence module estimates how much each training sample affects the model’s predictions.

### Technique

The system uses an approximation of influence functions, implemented through the TracIn algorithm.

This technique computes gradient similarity between samples across multiple training checkpoints.

### Output

The module produces influence scores indicating which samples have the strongest effect on model behavior.

## Spectral Signature Detection Module

The spectral signature module analyzes hidden representations to detect clusters of poisoned samples.

### Technique

It uses Singular Value Decomposition (SVD) to identify dominant directions in the representation space.

Poisoned samples tend to cluster together because they share the same hidden trigger pattern.

The algorithm projects samples onto the dominant singular vector and assigns anomaly scores.

### Output

The module produces a score indicating the likelihood that each sample belongs to a poisoned cluster.

## Suspicion Score Fusion

The tracer module combines results from all detection modules to compute a final suspicion score for each dataset sample.

The fusion process integrates:

- scanner findings

- spectral signature scores

- influence scores

Each signal contributes a weighted value to the final score.


## AI Module Pipeline

The complete AI detection pipeline follows this process:

```
Dataset
   │
   ▼
Sandbox Training
   │
   ▼
Scanner Modules
   │
   ├── BackdoorScan
   ├── IntegrityScan
   └── DriftScan
   │
   ▼
Reverse Engineering
   │
   ├── Influence Analysis
   └── Spectral Signature
   │
   ▼
Tracer Fusion
   │
   ▼
Suspicion Scores
   │
   ▼
Security Report
```

This modular architecture allows Poison AI to detect multiple attack types while maintaining extensibility and scalability