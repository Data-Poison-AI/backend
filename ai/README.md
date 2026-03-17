# 🧠 Módulo AI — Data Poison AI

Este módulo es el **corazón analítico** del proyecto. Es un pipeline de Python que recibe un dataset de entrenamiento (CSV, JSON, JSONL o Parquet), lo ingesta, fine-tunea un modelo de lenguaje en un sandbox controlado, y luego ejecuta múltiples técnicas de detección para encontrar **datos envenenados, backdoors y muestras corruptas**.

---

## 📁 Estructura del Módulo

```
ai/
├── main.py                     ← Punto de entrada CLI (orquestador principal)
├── config.py                   ← Configuración central del pipeline
├── requirements.txt            ← Dependencias Python
│
├── ingestion/
│   ├── loader.py               ← Carga el dataset en formato HuggingFace
│   └── validator.py            ← Valida la integridad del dataset
│
├── sandbox/
│   ├── model_registry.py       ← Resuelve qué modelo usar según la tarea
│   └── fine_tuner.py           ← Fine-tunea el modelo (sandbox controlado)
│
├── scanner/
│   ├── __init__.py             ← Registro de scans y función orquestadora
│   ├── base_scan.py            ← Clase abstracta y estructura de resultados
│   ├── backdoor_scan.py        ← Detecta backdoors y triggers ocultos
│   ├── integrity_scan.py       ← Detecta muestras mislabeled/corruptas
│   └── drift_scan.py           ← Detecta anomalías en el espacio de embeddings
│
├── reverse_engineer/
│   ├── activation.py           ← Spectral Signature Detection (SVD)
│   ├── influence.py            ← TracIn Influence Functions
│   └── tracer.py               ← Fusiona señales en score de sospecha
│
├── report/
│   ├── generator.py            ← Genera el reporte JSON final
│   ├── cleaner.py              ← Separa dataset clean vs flagged
│   └── exporter.py             ← Prepara la carpeta de output para el backend
│
├── utils/
│   └── models_downloader.py    ← Script one-time para bajar modelos de HuggingFace
│
└── models/                     ← Modelos descargados localmente
    ├── ditilgpt2/
    └── facebook_bart-base/
```

---

## ⚙️ Workflow Completo del Pipeline

```
Dataset ZIP (del backend)
        │
        ▼
   [1. INGESTIÓN]       → loader.py    — carga CSV/JSON/JSONL/Parquet como HF Dataset
        │
        ▼
   [2. VALIDACIÓN]      → validator.py — chequea columnas, vacíos, duplicados
        │
        ▼
   [3. SANDBOX FT]      → fine_tuner.py — fine-tunea un LM ligero (LoRA) con TODO el dataset
        │                                (incluido el veneno, a propósito)
        ▼
   [4. SCANS]           → backdoor_scan.py  — tokens raros con correlación de labels
                        → integrity_scan.py — muestras con pérdida persistentemente alta
                        → drift_scan.py     — outliers en espacio de embeddings
        │
        ▼
   [5. REVERSE ENG.]    → activation.py  — Spectral Signature (SVD sobre representations)
                        → tracer.py      — Fusiona señales → score de sospecha [0,1]
        │
        ▼
   [6. REPORTE]         → generator.py  — JSON con hallazgos, stats, top sospechosos
                        → cleaner.py    — divide el dataset en clean vs flagged
                        → exporter.py   — limpia el modelo sandbox y de deja output listo
        │
        ▼
   ZIP de reportes (lo empaqueta Node.js y lo devuelve al frontend)
```

---

## 📄 Análisis Línea por Línea

---

### `config.py` — Configuración Central

```python
# Línea 1
import uuid
# Importa uuid para generar identificadores únicos hexadecimales.
# Se usa para garantizar que cada ejecución tenga su propia carpeta de output.

# Línea 2
from dataclasses import dataclass, field
# 'dataclass' permite crear clases de configuración sin boilerplate.
# 'field' permite definir valores por defecto complejos (listas, lambdas).

# Línea 3
from datetime import datetime, timezone
# Para generar timestamps UTC, que se usan en nombres de archivo de output.

# Línea 4
from typing import Optional
# Permite declarar campos que pueden ser None (ej: label_column puede no existir).

# Línea 5
from pathlib import Path
# API moderna de Python para manejar rutas de archivos de forma cross-platform.

# Línea 7
CONFIG_DIR = Path(__file__).parent.resolve()
# __file__ = ruta de config.py → .parent = carpeta 'ai/' → .resolve() = ruta absoluta.
# CONFIG_DIR apunta a la carpeta 'ai/'.

# Línea 8
PROJECT_ROOT = CONFIG_DIR.parent
# Sube un nivel desde 'ai/' → apunta a la raíz del proyecto.

# Línea 9
UPLOADS_DIR = PROJECT_ROOT / "backend" / "uploads"
# Construye la ruta al directorio donde Node.js guarda los archivos subidos.
# Permite que el script Python encuentre automáticamente los datasets.

# Línea 11-12
@dataclass
class PoisonAIConfig:
# Declara la clase de configuración usando el decorador @dataclass.
# Automáticamente genera __init__, __repr__ y __eq__.

# Líneas 16-19 (Data fields)
data_path: str = ""          # Ruta al dataset a analizar
data_format: str = "auto"    # auto | csv | json | huggingface — cómo leer el dataset
text_column: str = "text"    # Nombre de la columna de texto en el dataset
label_column: Optional[str] = "label"  # Columna de etiquetas (puede ser None)

# Líneas 22-24 (Model fields)
task: str = "text-classification"  # Tipo de tarea NLP a realizar
base_model: str = "auto"           # ID del modelo HF o ruta local
trust_remote_code: bool = False    # Por seguridad, NO ejecutar código remoto por defecto

# Líneas 27-33 (Fine-tuning fields)
epochs: int = 3              # Epochs de entrenamiento — bajo para análisis rápido
batch_size: int = 8          # Tamaño de batch — balance entre VRAM y velocidad
learning_rate: float = 2e-5  # LR estándar para fine-tuning de transformers
max_seq_length: int = 512    # Máxima longitud de tokens (limitación de BERT/DistilBERT)
use_lora: bool = True        # LoRA = Low-Rank Adaptation → fine-tuning eficiente con pocos parámetros
lora_r: int = 8              # Rank de las matrices LoRA → menor = más compacto
lora_alpha: int = 16         # Factor de escala LoRA → controla magnitud de actualizaciones

# Líneas 36-38 (Scanning)
scans: list[str] = field(default_factory=lambda: ["backdoor", "integrity", "drift"])
# Lista de scans a ejecutar. Se usa 'field' con lambda porque las listas
# por defecto en dataclass necesitan factory para evitar sharing entre instancias.

# Línea 39
anomaly_threshold: float = 0.05
# Marca como anomalía el top 5% de muestras → ajustable según sensibilidad deseada.

# Líneas 42-43 (Reverse engineering)
influence_sample_size: int = 500  # Sub-muestra para influence functions (por costo computacional)
activation_clusters: int = 5      # Número de clusters para K-Means en análisis de activaciones

# Líneas 46-48 (Output)
timestamp: str = field(
    default_factory=lambda: datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
)
# Genera un timestamp UTC en el momento de crear la instancia.
# Se usa en nombres de archivos para hacerlos únicos y ordenables.

# Línea 49
output_dir: Optional[str] = None
# Si no se especifica, se genera automáticamente en __post_init__.

# Líneas 52-57 (__post_init__)
def __post_init__(self):
    if not self.output_dir:
        self.output_dir = f".poison_ai_output_{self.timestamp}_{uuid.uuid4().hex[:4]}"
    # Crea un nombre único para la carpeta de output combinando timestamp + 4 chars hex.
    # El prefijo '.' lo oculta en sistemas Unix.
    if self.data_path:
        self.data_path = self._resolve_data_path(self.data_path)
    # Resuelve la ruta del dataset automáticamente.

# Líneas 58-84 (_resolve_data_path)
def _resolve_data_path(self, path: str) -> str:
    # Implementa resolución inteligente de rutas en 4 pasos:
    path_obj = Path(path)
    if path_obj.is_absolute():
        return str(path_obj)
    # Caso 1: Ruta absoluta → usar tal cual.
    if path_obj.exists():
        return str(path_obj.resolve())
    # Caso 2: Existe relativa al CWD → resolver y usar.
    uploads_path = UPLOADS_DIR / path_obj.name
    if uploads_path.exists():
        return str(uploads_path)
    # Caso 3: Buscar solo por nombre en /uploads → caso principal con Express.
    uploads_path_full = UPLOADS_DIR / path_obj
    if uploads_path_full.exists():
        return str(uploads_path_full)
    # Caso 4: Ruta relativa completa dentro de uploads.
    return str(UPLOADS_DIR / path_obj.name)
    # Fallback: devolver la ruta en uploads aunque no exista → fallará después
    # con un mensaje de error claro.
```

---

### `main.py` — Orquestador Principal (CLI)

```python
# Líneas 1-6 (docstring)
"""
Poison AI — CLI entrypoint.
Usage: python main.py --data ./my_data.csv --task text-classification
"""
# Documenta el uso del script como herramienta de línea de comandos.

# Línea 8
import argparse
# Librería estándar para parsear argumentos de línea de comandos (--data, --task, etc.)

# Línea 9
from pathlib import Path
# Para manipulación de rutas de archivos.

# Líneas 11-21 (imports del proyecto)
from config import PoisonAIConfig, UPLOADS_DIR
# Importa la clase de configuración y la ruta de uploads para mensajes de error útiles.

from ingestion.loader import load_data      # Función que carga el dataset
from ingestion.validator import validate    # Función que valida el dataset
from sandbox.model_registry import resolve_model  # Resuelve qué modelo usar
from sandbox.fine_tuner import SandboxFineTuner   # Clase que hace el fine-tuning
from scanner import run_all_scans           # Función que ejecuta todos los scans
from reverse_engineer.activation import get_representations, spectral_signature_scores
# get_representations: extrae vectores de activación del modelo fine-tuneado
# spectral_signature_scores: calcula scores usando SVD (detección de envenenamiento)
from reverse_engineer.tracer import compute_suspicion_scores  # Fusiona señales
from report.generator import generate_report   # Genera el JSON de reporte
from report.cleaner import clean_dataset        # Divide dataset en clean vs flagged
from report.exporter import export_report_json # Prepara la carpeta para el backend

# Línea 23
from transformers import AutoModelForSequenceClassification, AutoTokenizer
# Clases de HuggingFace para cargar modelos y tokenizadores guardados en disco.

# Líneas 27-37 (argparse setup)
parser = argparse.ArgumentParser(description="Poison AI")
parser.add_argument("--data", required=True, ...)   # Dataset: OBLIGATORIO
parser.add_argument("--task", default="text-classification")  # Tipo de tarea NLP
parser.add_argument("--model", default="auto")       # Modelo: auto = detectar por tarea
parser.add_argument("--epochs", type=int, default=3) # Epochs de entrenamiento
parser.add_argument("--threshold", type=float, default=0.7)  # Score para marcar como sospechoso
parser.add_argument("--output", default="./poison_ai_output") # Carpeta de salida
parser.add_argument("--text-column", default="text")   # Nombre columna de texto
parser.add_argument("--label-column", default="label") # Nombre columna de labels

# Línea 39
model_path = resolve_model(args.task, args.model)
# Resuelve el modelo: primero busca local en ai/models/, luego HuggingFace Hub.

# Líneas 41-49 (PoisonAIConfig)
cfg = PoisonAIConfig(
    data_path=args.data,
    task=args.task,
    base_model=model_path,
    epochs=args.epochs,
    output_dir=args.output,
    text_column=args.text_column,
    label_column=args.label_column
)
# Instancia la configuración con todos los parámetros.
# __post_init__ automáticamente resuelve las rutas.

# Líneas 50-59 (validación de existencia del dataset)
if not Path(cfg.data_path).exists():
    # Si el archivo no existe, muestra un error descriptivo con:
    # - El nombre buscado
    # - La ruta resuelta
    # - La carpeta uploads
    # - Los archivos disponibles en uploads → muy útil para debugging
    return  # Sale limpiamente sin crash

# Líneas 74-83 (auto-detección de columnas)
if cfg.text_column not in dataset.column_names:
    cfg.text_column = dataset.column_names[0]
# Si la columna de texto no existe (datasets con nombres distintos),
# auto-selecciona la primera columna disponible.

if cfg.label_column and cfg.label_column not in dataset.column_names:
    if len(dataset.column_names) > 1:
        cfg.label_column = dataset.column_names[-1]
    else:
        cfg.label_column = None
# Similar para labels: si no existe, usa la última columna o la pone a None.
# Esto evita crashes con datasets de formatos inesperados.

# Línea 85
stats = validate(dataset, cfg.text_column, cfg.label_column)
# Corre las validaciones de sanidad y obtiene estadísticas básicas del dataset.

# Línea 88
num_labels = len(set(dataset[cfg.label_column])) if cfg.label_column else 2
# Cuenta las clases únicas en el dataset. El modelo necesita saber cuántas salidas tener.
# Si no hay labels, asume clasificación binaria (2 clases).

# Líneas 92-93 (Sandbox Fine-tuning)
ft = SandboxFineTuner(cfg, dataset, num_labels)
finetuned_model_path = ft.run()
# Crea el fine-tuner y lo ejecuta.
# El modelo entrenado se guarda en disco para el siguiente paso.

# Líneas 97-101 (Carga el modelo fine-tuneado para análisis)
model = AutoModelForSequenceClassification.from_pretrained(
    finetuned_model_path,
    output_hidden_states=True  # CRÍTICO: necesitamos los hidden states para los análisis
)
tokenizer = AutoTokenizer.from_pretrained(cfg.base_model)
# Carga el modelo guardado y el tokenizador original.
# output_hidden_states=True hace que el modelo devuelva las activaciones intermedias.

# Líneas 105-108 (Run Scans)
findings = run_all_scans(
    cfg.scans, model, tokenizer, dataset,
    ft.training_losses_per_sample, cfg,
)
# Ejecuta los 3 tipos de scan (backdoor, integrity, drift).
# Pasa las pérdidas de entrenamiento grabadas por _TracingTrainer.

# Líneas 112-114 (Spectral Signatures)
reps = get_representations(model, tokenizer, dataset[cfg.text_column], cfg.max_seq_length)
spec_scores = spectral_signature_scores(reps)
# Extrae los vectores CLS de la última capa oculta para cada muestra.
# Calcula scores usando la descomposición SVD (técnica de Tran et al., 2018).

# Líneas 117-120 (Suspicion Scores)
suspicion = compute_suspicion_scores(
    findings, len(dataset),
    spectral_scores=spec_scores,
)
# Combina TODAS las señales (scans + spectral) en un único score por muestra.
# Score en [0, 1] donde 1 = muy sospechoso.

# Líneas 123-128 (Report & Clean)
report = generate_report(cfg, findings, suspicion, stats, cfg.output_dir)
clean_ds, flagged_ds = clean_dataset(dataset, suspicion, args.threshold)
clean_path   = Path(cfg.output_dir) / f"clean_data-{cfg.timestamp}.json"
flagged_path = Path(cfg.output_dir) / f"flagged_data-{cfg.timestamp}.json"
clean_ds.to_json(clean_path)
flagged_ds.to_json(flagged_path)
# Genera el reporte JSON, divide el dataset en clean vs flagged,
# y guarda ambos como archivos JSON nombrados con el timestamp.

# Línea 135
export_report_json(cfg)
# Limpia el modelo del sandbox (pesado, ya no se necesita)
# y deja la carpeta de output lista para que Node.js la zipee.
```

---

### `ingestion/loader.py` — Cargador de Datasets

```python
# Línea 1
import json, csv, pathlib
# Importaciones estándar (json y csv no se usan directamente, pero pathlib sí).

# Línea 2
from datasets import load_dataset, Dataset
# HuggingFace 'datasets' — biblioteca que unifica la carga de múltiples formatos
# y los convierte a un Dataset optimizado (columnar, con Arrow backing).

# Líneas 4-5
def load_data(path: str, fmt: str = "auto", **kwargs) -> Dataset:
    p = pathlib.Path(path)
    # Convierte la string de ruta a un objeto Path para poder acceder a .suffix.

# Líneas 9-10
if fmt == "auto":
    fmt = p.suffix.lstrip(".")
# Si el formato es "auto", extrae la extensión del archivo (.csv → "csv").
# lstrip(".") elimina el punto inicial de la extensión.

# Líneas 12-21 (match statement)
match fmt:
    case "csv":
        return load_dataset("csv", data_files=str(p), split="train")
    # Carga CSV nativamente con HF datasets. split="train" devuelve el Dataset completo.

    case "json" | "jsonl":
        return load_dataset("json", data_files=str(p), split="train")
    # Soporta tanto JSON como JSONL (JSON Lines, un objeto por línea).

    case "parquet":
        return load_dataset("parquet", data_files=str(p), split="train")
    # Formato columnar eficiente, común en datasets de ML grandes.

    case _:
        return load_dataset(path, split="train")
    # Fallback: trata la ruta como un identificador de HuggingFace Hub
    # (ej: "stanfordnlp/imdb" → descarga directamente del Hub).
```

---

### `ingestion/validator.py` — Validador de Datasets

```python
# Línea 3
class ValidationError(Exception): ...
# Define una excepción personalizada para errores de validación.
# La elipsis '...' es equivalente a 'pass' — clase vacía heredada de Exception.

# Líneas 5-6
def validate(dataset: Dataset, text_col: str, label_col: str | None):
    """Basic sanity checks before we send data to the sandbox."""
# Función que verifica la integridad básica del dataset antes de procesarlo.

# Líneas 8-10 (validación columna texto)
if text_col not in dataset.column_names:
    raise ValidationError(f"Text column '{text_col}' not found. "
                          f"Available: {dataset.column_names}")
# Si la columna de texto no existe, lanza error ANTES de intentar entrenar.
# El mensaje incluye los nombres disponibles para facilitar corrección.

# Líneas 12-13 (validación columna labels)
if label_col and label_col not in dataset.column_names:
    raise ValidationError(f"Label column '{label_col}' not found.")
# Solo valida labels si se especificó una (puede ser None para datasets sin labels).

# Líneas 16-20 (estadísticas)
stats = {
    "total_rows": len(dataset),
    # Número total de muestras en el dataset.

    "empty_text_rows": sum(1 for t in dataset[text_col] if not str(t).strip()),
    # Cuenta filas donde el texto está vacío o solo tiene espacios.
    # str(t) convierte a string por si hay None/NaN.

    "duplicate_rows": len(dataset) - len(set(dataset[text_col])),
    # Diferencia entre total y únicos → número de duplicados exactos.
    # Los duplicados pueden inflar artificialmente el impacto de muestras envenenadas.
}

# Líneas 22-25 (distribución de labels)
if label_col:
    from collections import Counter
    label_dist = Counter(dataset[label_col])
    stats["label_distribution"] = dict(label_dist)
# Si hay labels, calcula cuántas muestras hay por clase.
# Un desbalance extremo (ej: 99% clase A) puede indicar envenenamiento.
```

---

### `sandbox/model_registry.py` — Registro de Modelos

```python
# Línea 3
LOCAL_MODEL_DIR = Path(__file__).parent.parent / "models"
# __file__ = model_registry.py → .parent = sandbox/ → .parent = ai/ → / "models"
# Apunta a ai/models/ donde se guardan los modelos descargados localmente.

# Líneas 5-11 (TASK_MODEL_MAP)
TASK_MODEL_MAP = {
    "text-classification": "distilbert-base-uncased",
    # DistilBERT: versión destilada de BERT, 40% más pequeña, 97% de precisión.

    "text-generation":     "distilgpt2",
    # DistilGPT2: versión destilada de GPT-2, más rápida para generación.

    "ner":                 "distilbert-base-uncased",
    # Named Entity Recognition también usa DistilBERT.

    "sentiment":           "distilbert-base-uncased",
    # Análisis de sentimientos: clasificación binaria/multiclase.

    "summarization":       "facebook/bart-base",
    # BART: modelo seq2seq ideal para resumir texto.
}

# Líneas 13-32 (resolve_model)
def resolve_model(task: str, explicit: str | None = None) -> str:
    if explicit and explicit != "auto":
        model_id = explicit
    # Si el usuario especificó un modelo concreto, usarlo directamente.
    else:
        model_id = TASK_MODEL_MAP.get(task, "distilbert-base-uncased")
    # Si es "auto", busca en el mapa. Si la tarea no existe, usa DistilBERT por defecto.

    local_model_name = model_id.replace("/", "_")
    # Convierte "facebook/bart-base" → "facebook_bart-base" (válido como nombre de carpeta).

    local_path = LOCAL_MODEL_DIR / local_model_name
    if local_path.exists():
        print(f"✅ Using local model: {local_path}")
        return str(local_path)
    # Prioriza modelos locales → más rápido, sin internet, reproducible.

    print(f"⚠️ Local model not found. Using HF Hub")
    return str(model_id)
    # Fallback: devuelve el ID de HF Hub para descarga en tiempo real.
```

---

### `sandbox/fine_tuner.py` — Fine-Tuner en Sandbox

```python
# Líneas 1-12 (imports)
import torch
from transformers import (
    AutoTokenizer,                         # Carga el tokenizador del modelo
    AutoModelForSequenceClassification,    # Modelo de clasificación de secuencias
    TrainingArguments,                     # Parámetros de entrenamiento de HF
    Trainer,                               # Clase de entrenamiento de alto nivel de HF
    DataCollatorWithPadding,               # Padding dinámico para batches
)
from peft import get_peft_model, LoraConfig, TaskType
# PEFT: Parameter-Efficient Fine-Tuning
# LoraConfig: configuración de Low-Rank Adaptation
# TaskType: enum de tipos de tarea para LoRA

# Líneas 22-35 (__init__)
def __init__(self, cfg, dataset, num_labels):
    self.tokenizer = AutoTokenizer.from_pretrained(model_path)
    # Carga el tokenizador asociado al modelo base.
    
    if self.tokenizer.pad_token is None:
        self.tokenizer.pad_token = self.tokenizer.eos_token
    # Algunos modelos GPT no tienen token de padding.
    # Se asigna el token de fin de secuencia como padding token.

    self.base_model = AutoModelForSequenceClassification.from_pretrained(
        model_path,
        num_labels=num_labels,
        trust_remote_code=cfg.trust_remote_code,
    )
    # Carga el modelo base con la cabeza de clasificación correcta
    # (num_labels determina el número de clases de salida).

# Líneas 38-48 (LoRA setup)
if cfg.use_lora:
    lora_cfg = LoraConfig(
        task_type=TaskType.SEQ_CLS,  # Tipo: clasificación de secuencias
        r=cfg.lora_r,                # Rank: dimensión de matrices de bajo rango (8)
        lora_alpha=cfg.lora_alpha,   # Factor de escala (16)
        lora_dropout=0.1,            # Dropout para regularización en LoRA
        target_modules=self._get_target_modules(model_path),
        # Módulos a adaptar (varía por arquitectura del modelo)
    )
    self.model = get_peft_model(self.base_model, lora_cfg)
    # Envuelve el modelo base con LoRA → solo entrena matrices de bajo rango.
    # Reduce parámetros entrenables de ~66M a ~300K (99.5% menos).

# Líneas 52-64 (_get_target_modules)
def _get_target_modules(self, model_path: str) -> list[str]:
    model_name = Path(model_path).name.lower()
    if "distilbert" in model_name:
        return ["q_lin", "v_lin"]    # Atención: query y value en DistilBERT
    elif "bert" in model_name:
        return ["query", "value"]    # Atención en BERT estándar
    elif "bart" in model_name:
        return ["q_proj", "v_proj"]  # Proyecciones en BART/T5
    elif "gpt" in model_name:
        return ["c_attn"]            # Proyección combinada en GPT-2
    else:
        return ["q_proj", "v_proj"]  # Defecto conservador
# Cada arquitectura nombra sus capas de atención diferente.
# LoRA DEBE apuntar a los módulos correctos o no funciona.

# Líneas 67-92 (_tokenize)
def _tokenize(self, dataset: Dataset) -> Dataset:
    def tok(batch):
        return self.tokenizer(
            batch[self.cfg.text_column],
            padding="max_length",   # Padding fijo a max_seq_length para uniformidad
            truncation=True,         # Cortar textos largos en max_seq_length
            max_length=self.cfg.max_seq_length,  # 512 tokens
        )
    
    columns_to_remove = dataset.column_names
    tokenized = dataset.map(tok, batched=True, remove_columns=columns_to_remove)
    # .map() aplica la tokenización en batches (eficiente).
    # remove_columns elimina las columnas originales de texto/labels
    # para evitar errores al convertir strings a tensores PyTorch.

    if self.cfg.label_column in dataset.column_names:
        labels_column = dataset[self.cfg.label_column]
        if isinstance(labels_column[0], str):
            unique_labels = sorted(list(set(labels_column)))
            l2id = {label: i for i, label in enumerate(unique_labels)}
            labels_column = [l2id[label] for label in labels_column]
        # Si los labels son strings (ej: "positive", "negative"),
        # los convierte a enteros (0, 1) para PyTorch.
        tokenized = tokenized.add_column("labels", labels_column)
        # Re-agrega los labels numéricos al dataset tokenizado.

# Líneas 95-114 (_TracingTrainer)
class _TracingTrainer(Trainer):
    """Subclass that stores per-sample losses every epoch."""
    
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.pop("labels")
        # Extrae los labels del batch de input.
        
        outputs = model(**inputs)
        # Forward pass sin labels (para obtener logits limpios).
        
        logits = outputs.logits
        
        loss_fn = torch.nn.CrossEntropyLoss(reduction="none")
        per_sample_loss = loss_fn(logits, labels)
        # CrossEntropyLoss con reduction="none" → pérdida INDIVIDUAL por muestra.
        # Crucial: sin esto solo tendríamos la pérdida promedio del batch.
        
        self.loss_store.append(per_sample_loss.detach().cpu().tolist())
        # Guarda las pérdidas individuales para análisis posterior.
        # .detach() = desconectar del grafo computacional
        # .cpu() = mover de GPU a RAM
        # .tolist() = convertir tensor a lista Python serializable
        
        loss = per_sample_loss.mean()
        # Pérdida promedio para el optimizer (estándar).

# Líneas 117-142 (run)
def run(self) -> Path:
    tokenized = self._tokenize(self.dataset)
    output_path = Path(self.cfg.output_dir) / "sandbox_model"
    
    args = TrainingArguments(
        output_dir=str(output_path),
        num_train_epochs=self.cfg.epochs,            # 3 epochs por defecto
        per_device_train_batch_size=self.cfg.batch_size,  # 8 muestras por batch
        learning_rate=self.cfg.learning_rate,         # 2e-5
        logging_steps=10,      # Log cada 10 steps
        save_strategy="epoch", # Guardar checkpoint al final de cada epoch
        report_to="none",      # No enviar métricas a W&B/TensorBoard
    )
    
    trainer = self._TracingTrainer(
        loss_store=self.training_losses_per_sample,
        # Lista donde se acumulan las pérdidas por muestra (para análisis).
        model=self.model,
        args=args,
        train_dataset=tokenized,
        data_collator=DataCollatorWithPadding(self.tokenizer),
        # DataCollatorWithPadding aplica padding dinámico al mínimo necesario.
    )
    
    trainer.train()
    # Entrena el modelo. Las pérdidas se van guardando en loss_store.
    
    trainer.save_model(str(output_path / "final"))
    # Guarda el modelo final en disco para cargarlo en el siguiente paso.
    
    return output_path / "final"
    # Devuelve la ruta al modelo guardado.
```

---

### `scanner/base_scan.py` — Estructura Base

```python
# Líneas 1-2
from abc import ABC, abstractmethod
# ABC = Abstract Base Class → fuerza que las subclases implementen ciertos métodos.

from dataclasses import dataclass
# Para el dataclass ScanFinding.

# Líneas 4-11 (ScanFinding)
@dataclass
class ScanFinding:
    scan_name: str           # Nombre del scanner que encontró el hallazgo
    severity: str            # Severidad: "low" | "medium" | "high" | "critical"
    description: str         # Descripción humanamente legible del hallazgo
    affected_indices: list[int]  # Índices de las filas sospechosas en el dataset
    confidence: float        # Confianza del detector: 0.0 (baja) a 1.0 (alta)
    metadata: dict = None    # Datos adicionales opcionales (tokens, patrones, etc.)

# Líneas 13-18 (BaseScan)
class BaseScan(ABC):
    name: str = "base"       # Nombre del scanner, se sobreescribe en subclases

    @abstractmethod
    def run(self, model, tokenizer, dataset, train_losses, cfg) -> list[ScanFinding]:
        ...
    # Método abstracto: TODA subclase DEBE implementar run().
    # Recibe el modelo, tokenizador, dataset, pérdidas de entrenamiento y config.
    # Devuelve una lista de hallazgos (ScanFinding).
```

---

### `scanner/__init__.py` — Registro de Scans

```python
# Líneas 1-3 (imports)
from .backdoor_scan import BackdoorScan
from .integrity_scan import IntegrityScan
from .drift_scan import DriftScan
# Importa todas las implementaciones de scanners.

# Líneas 5-9 (SCAN_REGISTRY)
SCAN_REGISTRY = {
    "backdoor":  BackdoorScan,
    "integrity": IntegrityScan,
    "drift":     DriftScan,
}
# Diccionario que mapea nombres de string a clases.
# Permite activar/desactivar scans por nombre sin tocar código condicional.

# Líneas 11-20 (run_all_scans)
def run_all_scans(scan_names, model, tokenizer, dataset, train_losses, cfg):
    all_findings = []
    for name in scan_names:
        scanner = SCAN_REGISTRY[name]()
        # Instancia el scanner correspondiente.
        
        print(f"  ⏳ Running scan: {scanner.name}")
        
        results = scanner.run(model, tokenizer, dataset, train_losses, cfg)
        # Ejecuta el scan y obtiene la lista de hallazgos.
        
        all_findings.extend(results)
        # Agrega los hallazgos a la lista global.
        
        for f in results:
            print(f"    [{f.severity.upper()}] {f.description}")
        # Imprime cada hallazgo con su severidad en color (UPPER para visibilidad).
    
    return all_findings
    # Devuelve TODOS los hallazgos de todos los scans.
```

---

### `scanner/backdoor_scan.py` — Detección de Backdoors

```python
# Estrategia: usa 2 señales independientes para detectar backdoors

# --- SEÑAL 1: Correlación token-label ---
# Líneas 23-53

token_label: dict[str, list] = {}
for i, text in enumerate(texts):
    tokens = text.lower().split()
    # Tokenización naive por espacios (suficiente para detectar palabras raras).
    for tok in set(tokens):  # set() evita contar el mismo token 2 veces en el mismo texto
        token_label.setdefault(tok, []).append(labels[i])
# Construye un índice: para cada token, qué labels han aparecido con él.

for tok, lbls in token_label.items():
    if len(lbls) < 3:
        continue  # Ignorar tokens rarísimos (solo 1-2 apariciones → ruido)
    most_common_label, count = Counter(lbls).most_common(1)[0]
    ratio = count / len(lbls)
    if ratio > 0.95 and len(lbls) > 5:
        suspicious_tokens.append(...)
# Un token es sospechoso si:
# - Aparece en más de 5 muestras (significativo estadísticamente)
# - En más del 95% de esas muestras tiene el MISMO label
# → Posible backdoor trigger: el modelo aprende "si ves esta palabra → predice X"

# --- SEÑAL 2: Loss outliers (muestras de convergencia rápida) ---
# Líneas 56-75

all_losses = np.array(train_losses)    # (steps, batch_size)
mean_loss  = np.mean(all_losses, axis=0)  # Pérdida promedio por posición de muestra
threshold = np.percentile(mean_loss, 5)   # Percentil 5% = pérdidas más bajas
fast_learners = np.where(mean_loss < threshold)[0].tolist()
# Las muestras con pérdida ANORMALMENTE BAJA convergen rápido porque el modelo
# aprende un "atajo" (shortcut). Los backdoors son atajos: si el trigger está
# presente, la predicción es trivial. Esto se refleja en pérdida baja desde epoch 1.
```

---

### `scanner/integrity_scan.py` — Detección de Mislabeling

```python
# Principio: si el modelo consistentemente NO puede aprender una muestra
# (pérdida alta en TODOS los epochs), probablemente la muestra está mislabeled.

all_losses = np.array(train_losses)
mean_loss  = np.mean(all_losses, axis=0)
# Pérdida promedio por muestra a lo largo del entrenamiento.

threshold = np.percentile(mean_loss, 100 - (cfg.anomaly_threshold * 100))
# Con anomaly_threshold=0.05 → percentil 95
# Las muestras en el top 5% de pérdida son candidatas a estar corruptas.

bad_indices = np.where(mean_loss > threshold)[0].tolist()
# Índices de las muestras con pérdida persistentemente alta.
# Severidad: "high" porque el mislabeling es un tipo común de envenenamiento.
```

---

### `scanner/drift_scan.py` — Detección de Deriva de Embeddings

```python
# Usa IsolationForest para detectar outliers en el espacio de embeddings.
# Muestras adversariales o de distribución diferente se separan del cluster principal.

@torch.no_grad()  # No calcular gradientes → más rápido y menos memoria
def _get_embeddings(self, model, tokenizer, texts, max_len):
    model.eval()  # Modo evaluación: desactiva dropout
    for text in texts:
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=max_len)
        inputs = {k: v.to(model.device) for k, v in inputs.items()}
        # Mueve los tensores al mismo dispositivo que el modelo (CPU o GPU).
        
        outputs = model(**inputs, output_hidden_states=True)
        cls_emb = outputs.hidden_states[-1][:, 0, :]
        # hidden_states[-1] = última capa oculta (la más representativa)
        # [:, 0, :] = token [CLS] = representación GLOBAL de la secuencia
        embeddings.append(cls_emb.cpu().numpy().flatten())
    return np.stack(embeddings)  # (n_samples, hidden_size)

iso = IsolationForest(contamination=cfg.anomaly_threshold, random_state=42)
preds = iso.fit_predict(embs)  # -1 = outlier, +1 = normal
# contamination=0.05 → espera ~5% de outliers.
# IsolationForest: construye árboles de decisión aleatorios y mide
# cuántos "splits" necesita para aislar una muestra → menos = más outlier.
```

---

### `reverse_engineer/activation.py` — Spectral Signature Detection

```python
# Basado en: "Spectral Signatures in Backdoor Attacks" (Tran et al., 2018)
# Idea: las muestras envenenadas forman un cluster separable en el espacio de activaciones.

def spectral_signature_scores(reps: np.ndarray) -> np.ndarray:
    centred = reps - reps.mean(axis=0)
    # Centra los vectores restando la media → necesario para SVD significativa.
    
    _, S, Vt = np.linalg.svd(centred, full_matrices=False)
    # SVD (Descomposición en Valores Singulares):
    # _ = valores singulares izquierdos (no los usamos)
    # S = valores singulares (magnitudes de las componentes)
    # Vt = vectores singulares derechos (direcciones principales de varianza)
    
    top_v = Vt[0]
    # El primer vector singular (mayor varianza).
    # Las muestras envenenadas se alinean con esta dirección.
    
    scores = (centred @ top_v) ** 2
    # Proyección al cuadrado de cada muestra sobre el vector principal.
    # Alto score → la muestra se alinea fuertemente con la dirección de veneno.
    return scores
```

---

### `reverse_engineer/tracer.py` — Fusión de Señales

```python
# Combina todas las señales en un único score de sospecha normalizado.

severity_weight = {"critical": 1.0, "high": 0.8, "medium": 0.5, "low": 0.2}
for f in findings:
    w = severity_weight.get(f.severity, 0.3) * f.confidence
    # Peso = severidad × confianza
    # Un hallazgo HIGH con confianza 0.8 contribuye: 0.8 × 0.8 = 0.64
    
    for idx in f.affected_indices:
        if idx < dataset_size:
            scores[idx] += w
    # Acumula el peso en cada muestra afectada.

if spectral_scores is not None:
    normed = spectral_scores / (spectral_scores.max() + 1e-9)
    scores += normed * 0.6
    # Los spectral scores contribuyen con peso 0.6.
    # +1e-9 evita división por cero.

# Normalización final a [0, 1]
scores = (scores - scores.min()) / (scores.max() - scores.min() + 1e-9)
```

---

### `report/generator.py` — Generador de Reportes

```python
# Genera un JSON estructurado con todos los hallazgos del análisis.

report = {
    "generated_at": datetime.now(timezone.utc).isoformat(),  # Timestamp ISO 8601
    "config": { "model": ..., "task": ..., "epochs": ... },  # Configuración usada
    "data_stats": data_stats,      # Stats del dataset (filas, vacíos, distribución)
    "total_samples": len(suspicion_scores),  # Total de muestras analizadas
    "flagged_samples": int((suspicion_scores >= 0.7).sum()),
    # Número de muestras con score ≥ 0.7 (umbral para marcar como sospechosa).
    "scan_findings": [...],        # Lista de hallazgos de cada scanner
    "top_suspicious_indices": (
        np.argsort(suspicion_scores)[::-1][:20].tolist()
    )
    # Top 20 índices más sospechosos, ordenados de mayor a menor score.
}
report_path = out / f"report-{cfg.timestamp}.json"
report_path.write_text(json.dumps(report, indent=2))
# Escribe el reporte con indentación legible.
```

---

### `report/cleaner.py` — Separador de Dataset

```python
def clean_dataset(dataset, suspicion_scores, threshold=0.7):
    flagged_mask = suspicion_scores >= threshold
    # Máscara booleana: True donde el score supera el umbral de sospecha.
    
    flagged_idx = np.where(flagged_mask)[0].tolist()
    clean_idx   = np.where(~flagged_mask)[0].tolist()
    # ~flagged_mask = NOT de la máscara → muestras limpias.
    
    return dataset.select(clean_idx), dataset.select(flagged_idx)
    # .select() de HF datasets: crea subconjuntos eficientes sin copiar datos.
```

---

### `report/exporter.py` — Exportador

```python
def remove_ai_sandbox(SOURCE_DIR):
    sandbox_models = SOURCE_DIR / "sandbox_model"
    if sandbox_models.exists() and sandbox_models.is_dir():
        shutil.rmtree(str(sandbox_models))
    # Elimina la carpeta del modelo fine-tuneado (puede ser varios GBs)
    # para no incluirla en el ZIP que se descarga el usuario.

def export_report_json(cfg: PoisonAIConfig):
    SOURCE_DIR = (PROJECT_ROOT / "ai" / cfg.output_dir).resolve()
    remove_ai_sandbox(SOURCE_DIR)
    # Deja solo: report-*.json, clean_data-*.json, flagged_data-*.json
    print(f"Prepared output folder for backend: {SOURCE_DIR}")
    # Node.js buscará esta carpeta y la zippeará para enviarla al cliente.
```

---

### `utils/models_downloader.py` — Descargador de Modelos

```python
from huggingface_hub import snapshot_download

# Descarga el modelo completo (pesos, tokenizador, config) de HuggingFace Hub
# y lo guarda en carpetas locales. Script one-time que se ejecuta una sola vez
# durante el setup del proyecto para tener los modelos disponibles offline.

snapshot_download(repo_id="distilgpt2", local_dir="./models/ditilgpt2/")
snapshot_download(repo_id="distilbert-base-uncased", local_dir="./models/distilbert-base-uncased/")
snapshot_download(repo_id="facebook/bart-base", local_dir="./models/facebook_bart-base/")
```

---

## 📦 Dependencias (`requirements.txt`)

| Librería | Versión | Uso |
|----------|---------|-----|
| `transformers` | ≥4.36 | Modelos y tokenizadores HuggingFace |
| `datasets` | ≥2.16 | Carga y manipulación de datasets |
| `torch` | ≥2.1 | Framework de deep learning |
| `peft` | ≥0.7 | LoRA y fine-tuning eficiente |
| `accelerate` | ≥0.25 | Entrenamiento optimizado (multi-GPU/CPU) |
| `scikit-learn` | ≥1.3 | IsolationForest para DriftScan |
| `numpy` | ≥1.24 | Álgebra lineal (SVD, percentiles) |
| `scipy` | ≥1.11 | Estadísticas avanzadas |
| `matplotlib` | ≥3.7 | Visualizaciones (disponible para extensión) |
| `tqdm` | ≥4.66 | Barras de progreso |
| `docker` | ≥7.0 | API de Docker (disponible para sandbox) |
| `jinja2` | ≥3.1 | Templates HTML para reportes |
