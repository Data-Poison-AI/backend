# 🛡️ Data Poison AI — Documentación Completa del Proyecto

**Data Poison AI** es una plataforma para detectar **envenenamiento de datos en modelos de IA**. Analiza datasets de entrenamiento en busca de backdoors, muestras corruptas, triggers ocultos y anomalías de distribución. El resultado es un reporte detallado exportable en ZIP con los datasets limpios y marcados como sospechosos.

---

## 🗺️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────┐
│                  USUARIO (Browser)               │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │      Frontend — Nginx (Puerto 80)         │    │
│  │  HTML + CSS + JavaScript Vanilla          │    │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐  │    │
│  │  │index.html│ │login.html│ │scanner   │  │    │
│  │  │(landing) │ │(auth)    │ │.html     │  │    │
│  │  └─────────┘ └──────────┘ └────┬─────┘  │    │
│  └──────────────────────────────── │ ───────┘    │
│                                    │              │
│              fetch('/api/uploads') │              │
└────────────────────────────────────│──────────────┘
                                     │
                     Nginx proxy_pass │ /api/ → backend:3000
                                     │
┌────────────────────────────────────▼──────────────┐
│          Backend — Node.js Express (Puerto 3000)   │
│                                                    │
│  POST /api/auth/login     → PostgreSQL (auth)      │
│  POST /api/auth/register  → PostgreSQL (registro)  │
│  POST /api/uploads        → Multer → Python AI     │
│                                     │              │
│         spawn('python main.py')     │              │
└─────────────────────────────────────│──────────────┘
                                      │
┌─────────────────────────────────────▼──────────────┐
│        Motor IA — Python (ai/main.py)               │
│                                                     │
│  1. Ingestión       → HuggingFace datasets          │
│  2. Validación      → chequeos de sanidad           │
│  3. Sandbox FT      → LoRA fine-tuning              │
│  4. Scans           → backdoor | integrity | drift  │
│  5. Reverse Eng.    → Spectral Signatures (SVD)     │
│  6. Reporte         → JSON + datasets clean/flagged │
└─────────────────────────────────────────────────────┘
                          │
                          ▼ ZIP de reportes
┌─────────────────────────────────────────────────────┐
│             PostgreSQL (Puerto 5432)                 │
│  Tabla: users (id, username, email, password_hash)  │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```
backend/                            ← raíz del repo
├── docker-compose.yml              ← Orquestación de todos los servicios
├── .gitignore
├── README.md                       ← Este archivo
│
├── ai/                             ← Motor de IA (Python)
│   ├── README.md                   ← Documentación del módulo AI
│   ├── main.py                     ← Entrypoint CLI del pipeline
│   ├── config.py                   ← Configuración central
│   ├── requirements.txt            ← Dependencias Python
│   ├── ingestion/                  ← Carga y validación de datos
│   ├── sandbox/                    ← Fine-tuning controlado con LoRA
│   ├── scanner/                    ← Detectores de amenazas
│   ├── reverse_engineer/           ← Análisis espectral y de influencia
│   ├── report/                     ← Generación y exportación de reportes
│   ├── utils/                      ← Descargador de modelos
│   └── models/                     ← Modelos HuggingFace locales
│
├── backend/                        ← API REST (Node.js + Express)
│   ├── README.md                   ← Documentación del módulo backend
│   ├── index.js                    ← Servidor principal
│   ├── routes/                     ← Rutas API
│   ├── controllers/                ← Lógica de negocio
│   ├── middlewares/                ← CORS, error handler
│   ├── models/                     ← Conexión PostgreSQL
│   ├── services/                   ← Encriptación y ZIP
│   ├── uploads/                    ← Archivos temporales entrantes (Multer)
│   └── downloads/                  ← ZIPs de reportes temporales
│
└── frontend/                       ← Interfaz web (HTML/CSS/JS + Nginx)
    ├── README.md                   ← Documentación del módulo frontend
    ├── nginx.conf                  ← Servidor web y reverse proxy
    ├── Dockerfile
    ├── html/                       ← Páginas
    ├── css/                        ← Estilos globales
    └── js/                         ← Lógica cliente
```

---

## 🔄 Workflow Completo — De Usuario a Reporte

### Paso 0: Setup Inicial (Una sola vez)

```bash
# Clonar el repositorio
git clone <repo-url>
cd backend

# (Opcional) Descargar modelos AI localmente para no depender de internet
cd ai
pip install huggingface_hub
python utils/models_downloader.py
# Descarga: distilgpt2, distilbert-base-uncased, facebook/bart-base
# Estos se guardan en ai/models/
```

---

### Paso 1: Levantar los Servicios con Docker

```bash
# Desde la raíz del proyecto
docker-compose up --build

# Servicios que se levantan:
# ● db       → PostgreSQL:15 en puerto 5432
# ● backend  → Node.js:20 en puerto 3000 (también instala deps Python)
# ● frontend → Nginx:alpine en puerto 80
```

**Dependencias de arranque (depends_on en docker-compose):**
- `frontend` espera a `backend`
- `backend` espera a `db`

---

### Paso 2: Registro y Login de Usuario

```
1. Usuario abre http://localhost en el browser
2. Nginx sirve /html/index.html (landing page)
3. Usuario hace clic en "Iniciar Sesión" → /html/login.html
4. Completa el formulario de registro:
   - Frontend: fetch POST /api/auth/register { username, email, password }
   - Nginx: proxy_pass → http://backend:3000/api/auth/register
   - Backend: valida, hashea password con scrypt, INSERT en PostgreSQL
   - Respuesta: { message: "¡Cuenta creada con éxito!", user: {...} }
5. Frontend muestra el formulario de login
6. Usuario hace login:
   - Frontend: fetch POST /api/auth/login { email, password }
   - Backend: SELECT usuario, verifica hash con timingSafeEqual
   - Respuesta exitosa: objeto usuario sin password
   - Frontend: localStorage.setItem('user', JSON.stringify(data))
   - Redirect: window.location.href = 'scanner.html'
```

---

### Paso 3: Preparar el Dataset

El usuario debe preparar un archivo ZIP que contenga uno o varios archivos de datos:

```
mi_dataset.zip
├── training_data.csv     ← Formato: columnas 'text' y 'label' (configurables)
├── extra_samples.json    ← Formato: lista de objetos con los mismos campos
└── large_dataset.parquet ← Formatos soportados: CSV, JSON, JSONL, Parquet
```

**Requisitos del dataset:**
- Mínimo: Una columna de texto (default: `text`)
- Recomendado: Una columna de labels (default: `label`)
- El AI auto-detecta columnas si los nombres no coinciden con los defaults

---

### Paso 4: Análisis de IA (Flujo Técnico Detallado)

```
Usuario en scanner.html
        │
        │ Drag & drop o selección del ZIP
        ▼
fileInput.onchange → muestra nombre del archivo
        │
        │ Clic en "Analizar"
        ▼
processAnalysis()
        │
        │ Validación: ¿existe el archivo? ¿termina en .zip?
        │
        │ fetch POST /api/uploads con FormData { file: <ZIP> }
        ▼
Nginx recibe request → proxy_pass → backend:3000/api/uploads
        │
Multer procesa multipart/form-data
        │   → Guarda ZIP en: backend/uploads/<random-hash>
        │   → Popula req.file con { path, filename, size, ... }
        ▼
uploadZip() — controlador principal
        │
        │ [PASO 1] Descomprimir
        │   unzipFiles(req.file.path, extractPath)
        │   Extrae en: backend/uploads/unzip_<timestamp>/
        │   Elimina el ZIP original
        │
        │ [PASO 2] Buscar datasets
        │   getAllFiles(extractPath) → lista recursiva de todos los archivos
        │   filter('.csv' | '.json' | '.parquet' | '.jsonl')
        │   Si 0 archivos → error 400, cleanup, return
        │
        │ [PASO 3] Loop por cada dataset (SECUENCIAL)
        │   for (dataFile of dataFiles):
        │     spawn('python', ['ai/main.py',
        │       '--data',         <dataFile>,
        │       '--task',         'text-classification',
        │       '--text-column',  req.body.text_column || 'sample',
        │       '--label-column', req.body.label_column || 'emotion'
        │     ], cwd: 'ai/')
        │
        │     PROCESO PYTHON — main.py:
        │     ├── [1] config.py: PoisonAIConfig({ data_path, task, ... })
        │     │       _resolve_data_path: busca el archivo en 4 lugares
        │     │
        │     ├── [2] ingestion/loader.py: load_data(path)
        │     │       Detecta formato por extensión
        │     │       Carga como HuggingFace Dataset
        │     │
        │     ├── [3] ingestion/validator.py: validate(dataset, text_col, label_col)
        │     │       Verifica columnas, cuenta vacíos y duplicados
        │     │       Calcula distribución de labels
        │     │
        │     ├── [4] sandbox/model_registry.py: resolve_model(task, model)
        │     │       Busca primero en ai/models/ (local)
        │     │       Fallback a HuggingFace Hub
        │     │
        │     ├── [5] sandbox/fine_tuner.py: SandboxFineTuner.run()
        │     │       Carga tokenizador y modelo base
        │     │       Aplica LoRA (Parameter-Efficient Fine-Tuning)
        │     │       Entrena con _TracingTrainer (guarda pérdidas por muestra)
        │     │       Guarda modelo en: output_dir/sandbox_model/final/
        │     │
        │     ├── [6] Carga modelo fine-tuneado con output_hidden_states=True
        │     │
        │     ├── [7] scanner/__init__.py: run_all_scans(...)
        │     │       BackdoorScan:
        │     │         - Análisis de correlación token-label (>95% → sospechoso)
        │     │         - Loss outliers (percentil 5% = fast learners)
        │     │       IntegrityScan:
        │     │         - Loss persistentemente alto → mislabeled (percentil 95%)
        │     │       DriftScan:
        │     │         - Embeddings CLS → IsolationForest → outliers
        │     │
        │     ├── [8] reverse_engineer/activation.py:
        │     │       get_representations: extrae CLS vectors de última capa
        │     │       spectral_signature_scores: SVD → scores de anomalía
        │     │
        │     ├── [9] reverse_engineer/tracer.py: compute_suspicion_scores(...)
        │     │       Combina: scan findings × severity × confidence
        │     │                + spectral scores × 0.6
        │     │       Normaliza a [0, 1]
        │     │
        │     ├── [10] report/generator.py: generate_report(...)
        │     │        Escribe: output_dir/report-<timestamp>.json
        │     │
        │     ├── [11] report/cleaner.py: clean_dataset(dataset, suspicion, 0.7)
        │     │        Threshold 0.7: score >= 0.7 → flagged
        │     │        Escribe: output_dir/clean_data-<timestamp>.json
        │     │        Escribe: output_dir/flagged_data-<timestamp>.json
        │     │
        │     └── [12] report/exporter.py: export_report_json(cfg)
        │              Elimina: output_dir/sandbox_model/ (GBs de pesos)
        │              Deja listo: output_dir/ con solo los reportes
        │
        │ [PASO 4] Cleanup de archivos extraídos
        │   fs.rmSync(extractPath, { recursive: true })
        │
        │ [PASO 5] Comprimir output AI
        │   zipFiles('ai/poison_ai_output/', 'backend/downloads/reports_<ts>.zip')
        │
        │ [PASO 6] Enviar ZIP al browser
        │   res.download(outputZipPath, 'poison_ai_reports.zip', callback)
        │   callback: cleanup de outputZipPath y aiOutputDir
        ▼
Frontend recibe response.blob()
        │
        │ URL.createObjectURL(blob) → URL temporal en memoria
        │
        │ Muestra botón "Descargar Reporte"
        │
        │ Usuario clica → <a href=blobUrl download=...>.click()
        ▼
ZIP descargado en el equipo del usuario

Contenido del ZIP:
├── report-20260316_190000.json     ← Reporte principal
├── clean_data-20260316_190000.json ← Dataset sin muestras sospechosas
└── flagged_data-20260316_190000.json ← Muestras marcadas (score >= 0.7)
```

---

## 📊 Estructura del Reporte JSON

```json
{
  "generated_at": "2026-03-16T19:00:00.000Z",
  "config": {
    "model": "/ai/models/distilbert-base-uncased",
    "task": "text-classification",
    "epochs": 3
  },
  "data_stats": {
    "total_rows": 1000,
    "empty_text_rows": 0,
    "duplicate_rows": 15,
    "label_distribution": { "positive": 600, "negative": 400 }
  },
  "total_samples": 1000,
  "flagged_samples": 47,
  "scan_findings": [
    {
      "scan": "backdoor",
      "severity": "high",
      "description": "Found 3 token(s) with >95% label correlation...",
      "affected_count": 142,
      "confidence": 0.75
    },
    {
      "scan": "integrity",
      "severity": "high",
      "description": "15 samples had persistently high loss...",
      "affected_count": 15,
      "confidence": 0.70
    },
    {
      "scan": "drift",
      "severity": "medium",
      "description": "8 samples are embedding-space outliers...",
      "affected_count": 8,
      "confidence": 0.55
    }
  ],
  "top_suspicious_indices": [142, 67, 891, 23, ...]
}
```

---

## 🔐 Seguridad

| Aspecto | Implementación |
|---------|----------------|
| Contraseñas | scrypt (resistente a GPU) + sal aleatoria por usuario |
| Comparación de hashes | `crypto.timingSafeEqual` (previene timing attacks) |
| SQL Injection | Queries parametrizadas con `$1, $2...` |
| CORS | Lista blanca de orígenes permitidos |
| Archivos | Nombres aleatorios de Multer, cleanup automático |
| Datos sensibles | `delete user.password` antes de enviar respuesta |

---

## 🐳 Docker Compose — Configuración Detallada

```yaml
services:
  backend:
    build: { context: ./, dockerfile: backend/Dockerfile }
    ports: ["3000:3000"]        # API accesible en localhost:3000
    volumes:
      - ./backend:/app          # Hot-reload del código backend
      - ./ai:/ai                # El backend necesita acceso al script Python
    depends_on: [db]
    environment:
      DB_HOST: db               # Nombre del servicio → DNS interno de Docker
      DB_USER: postgres
      DB_PASSWORD: poisonteamiariwi
      DB_NAME: postgres
      DB_PORT: 5432
      PORT: 3000

  db:
    image: postgres:15
    ports: ["5432:5432"]        # Accesible desde el host para desarrollo
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Persistencia de datos

  frontend:
    build: { context: ./frontend, dockerfile: Dockerfile }
    ports: ["80:80"]            # Punto de entrada principal del usuario
    volumes:
      - ./frontend:/usr/share/nginx/html         # Archivos estáticos
      - ./frontend/nginx.conf:/etc/nginx/conf.d/default.conf  # Config Nginx
    depends_on: [backend]

volumes:
  postgres_data:                # Volume nombrado → persiste entre docker-compose down/up
```

---

## 🚀 Comandos de Desarrollo

```bash
# Levantar todo el stack
docker-compose up --build

# Levantar en background
docker-compose up -d --build

# Ver logs en tiempo real
docker-compose logs -f backend   # Logs del Node.js + Python AI
docker-compose logs -f frontend  # Logs de Nginx

# Detener todo
docker-compose down

# Detener y eliminar datos de la BD
docker-compose down -v

# Acceder a la BD desde el host
psql -h localhost -U postgres -d postgres

# Ejecutar el AI directamente (sin Docker) para testing
cd ai
pip install -r requirements.txt
python main.py --data mi_dataset.csv --task text-classification
```

---

## 🔧 Variables de Entorno

| Variable | Servicio | Default | Descripción |
|----------|---------|---------|-------------|
| `DB_HOST` | backend | `localhost` | Host de PostgreSQL (en Docker: `db`) |
| `DB_USER` | backend | `postgres` | Usuario de PostgreSQL |
| `DB_PASSWORD` | backend | `poisonteamiariwi` | Contraseña de PostgreSQL |
| `DB_NAME` | backend | `postgres` | Nombre de la BD |
| `DB_PORT` | backend | `5432` | Puerto de PostgreSQL |
| `PORT` | backend | `3000` | Puerto del servidor Express |
| `FRONTEND_URL` | backend | - | URL del frontend en producción (para CORS) |
| `SERVER_URL` | backend | - | URL del servidor en producción (para CORS) |

---

## 📚 READMEs por Módulo

- [📄 AI Module README](./ai/README.md) — Análisis línea por línea del motor Python
- [📄 Backend README](./backend/README.md) — Análisis línea por línea de la API Node.js
- [📄 Frontend README](./frontend/README.md) — Análisis línea por línea de la UI

---

## 🔬 Algoritmos de Detección

| Algoritmo | Módulo | Paper de Referencia |
|-----------|--------|---------------------|
| Rare Token Analysis | `scanner/backdoor_scan.py` | - |
| Loss Trajectory Outliers | `scanner/backdoor_scan.py` | - |
| High-Loss Mislabeling | `scanner/integrity_scan.py` | - |
| Isolation Forest | `scanner/drift_scan.py` | Liu et al., 2008 |
| Spectral Signatures | `reverse_engineer/activation.py` | Tran et al., 2018 |
| TracIn Influence | `reverse_engineer/influence.py` | Pruthi et al., 2020 |
| LoRA Fine-Tuning | `sandbox/fine_tuner.py` | Hu et al., 2021 |

---

## 📝 Notas de Arquitectura

1. **El AI corre como subproceso de Node.js**, no como microservicio separado. Esto simplifica la comunicación (filesystem compartido via volúmenes Docker) pero significa que el proceso AI bloquea el thread de Node.js durante el análisis.

2. **Los modelos se resuelven en dos etapas**: primero se busca en `ai/models/` (local, rápido), como fallback se descarga de HuggingFace Hub. Para producción se recomienda siempre tener los modelos locales.

3. **El frontend usa localStorage** (no cookies/JWT server-side) para la sesión. Es suficiente para una app de análisis pero no es adecuado para producción multi-dispositivo.

4. **Los archivos temporales se limpian automáticamente**: uploads, carpetas extraídas, modelos sandbox y ZIPs de reportes. Solo persisten en disco durante el tiempo necesario.

5. **El análisis es secuencial** (un dataset a la vez) para no saturar la VRAM de la GPU si el servidor tiene una.