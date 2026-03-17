# ⚙️ Módulo Backend — Data Poison AI

El backend es una **API REST con Node.js + Express** que actúa como puente entre el frontend y el motor de IA Python. Maneja la autenticación de usuarios (con PostgreSQL), la recepción de archivos ZIP, la orquestación del proceso de análisis Python, y la devolución del reporte generado.

---

## 📁 Estructura del Módulo

```
backend/
├── index.js                        ← Punto de entrada del servidor Express
├── .env                            ← Variables de entorno (DB, puerto)
├── Dockerfile                      ← Imagen Docker de Node.js
├── package.json                    ← Dependencias y scripts NPM
│
├── routes/
│   ├── auth.route.js               ← Rutas de autenticación (/api/auth)
│   └── uploads.route.js            ← Ruta de uploads (/api/uploads)
│
├── controllers/
│   ├── auth.controller.js          ← Lógica de login y registro
│   └── uploads.controller.js       ← Lógica de procesamiento de archivos + AI
│
├── middlewares/
│   ├── cors-middleware.js          ← Control de orígenes permitidos (CORS)
│   └── error-handler.js            ← Manejo global de errores y 404
│
├── models/
│   └── db.model.js                 ← Pool de conexiones PostgreSQL y schema
│
├── services/
│   ├── encryption.service.js       ← Hash y verificación de contraseñas (scrypt)
│   └── zip.service.js              ← Comprimir y descomprimir archivos ZIP
│
├── uploads/                        ← Directorio temporal (Multer guarda aquí los ZIPs recibidos)
└── downloads/                      ← Directorio temporal (ZIPs de reportes listos para enviar)
```

---

## 🗺️ Mapa de Rutas API

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Registrar nuevo usuario |
| `POST` | `/api/auth/login` | Iniciar sesión |
| `POST` | `/api/uploads` | Subir ZIP + ejecutar análisis IA + descargar reporte |

---

## 🔄 Workflow de Uploads (Ruta Principal)

```
POST /api/uploads (multipart/form-data, campo 'file')
        │
        ▼
   Multer → guarda ZIP en /uploads/<random-hash> (temporal)
        │
        ▼
   [1] Descomprimir ZIP → /uploads/unzip_<timestamp>/
        │
        ▼
   [2] Buscar archivos de dataset (.csv, .json, .parquet, .jsonl)
        │
        ▼
   [3] Para cada dataset encontrado:
       spawn('python', ['ai/main.py', '--data', <path>, ...])
        │  (proceso hijo, captura stdout/stderr, espera exit code 0)
        ▼
   [4] Python genera la carpeta ai/poison_ai_output/
        │
        ▼
   [5] Comprimir ai/poison_ai_output/ → /downloads/poison_ai_reports_<ts>.zip
        │
        ▼
   [6] res.download() → envía el ZIP al browser
        │
        ▼
   Cleanup: eliminar ZIP temporal, carpeta unzip, ZIP de output, carpeta poison_ai_output
```

---

## 📄 Análisis Línea por Línea

---

### `index.js` — Servidor Principal

```javascript
// Línea 1
require("dotenv").config();
// Carga el archivo .env en process.env.
// DEBE ejecutarse PRIMERO, antes de cualquier import que use variables de entorno.

// Línea 3
const express = require("express");
// Framework web minimalista para Node.js.

// Líneas 4-8 (imports de módulos propios)
const routerAuth    = require("./routes/auth.route.js");
const routerUploads = require("./routes/uploads.route.js");
const corsMiddleware = require("./middlewares/cors-middleware.js");
const { initSchema, checkConnection } = require("./models/db.model.js");
const { errorHandler, notFound } = require("./middlewares/error-handler.js");
// Carga los módulos del proyecto. Cada uno exporta sus funciones/routers.

// Línea 10
const app = express();
// Crea la instancia de la aplicación Express.

// Línea 11
const PORT = process.env.PORT || 3000;
// Lee el puerto de la variable de entorno o usa 3000 por defecto.

// Línea 13
app.use(corsMiddleware);
// Aplica el middleware CORS a TODAS las rutas (debe ir primero).

// Línea 14
app.use(express.json());
// Parsea el body de requests con Content-Type: application/json.
// Sin esto, req.body estaría undefined en las rutas de auth.

// Línea 16
app.use("/api/auth", routerAuth);
// Monta el router de autenticación en /api/auth.
// Todas las rutas dentro de routerAuth serán relativas a /api/auth.

// Línea 17
app.use("/api/uploads", routerUploads);
// Monta el router de uploads en /api/uploads.

// Línea 19
app.use(notFound);
// Si ninguna ruta anterior coincidió → handler 404.
// Debe estar DESPUÉS de todas las rutas reales.

// Línea 20
app.use(errorHandler);
// Handler global de errores (4 parámetros = Express lo reconoce como error handler).
// Recibe errores propagados con next(err) desde cualquier ruta.

// Líneas 22-41 (función start)
async function start() {
    const db = await checkConnection();
    if (!db.ok) {
        console.error("No se pudo conectar a PostgreSQL:", db.message);
        process.exit(1);
        // Falla rápido si la BD no está disponible → mejor que errores silenciosos.
    }
    
    await initSchema();
    // Crea la tabla 'users' si no existe (idempotente con IF NOT EXISTS).
    
    app.listen(PORT, () => {
        console.log(`[SERVER] corriendo en http://localhost:${PORT}`);
    });
    // Inicia el servidor HTTP.
}

start();
// Llama a la función main asíncrona del servidor.
```

---

### `models/db.model.js` — Base de Datos PostgreSQL

```javascript
// Línea 2
const { Pool } = require("pg");
// Pool de conexiones de la librería 'pg' (node-postgres).
// Un pool reutiliza conexiones en lugar de crear una nueva por cada query.

// Líneas 4-13 (Pool config)
const pool = new Pool({
    user:     process.env.DB_USER     || "postgres",
    password: process.env.DB_PASSWORD || "poisonteamiariwi",
    host:     process.env.DB_HOST     || "localhost",
    // En Docker: DB_HOST=db (nombre del servicio en docker-compose)
    // En local: DB_HOST=localhost (PostgreSQL local)
    
    port: parseInt(process.env.DB_PORT || "5432", 10),
    // Puerto estándar de PostgreSQL. parseInt porque las envvars siempre son strings.
    
    database: process.env.DB_NAME || "postgres",
    max: 10,                    // Máximo 10 conexiones simultáneas en el pool
    idleTimeoutMillis: 30000,   // Conexión inactiva → cerrar después de 30s
    connectionTimeoutMillis: 2000, // Timeout para obtener conexión del pool: 2s
});

// Líneas 18-29 (checkConnection)
async function checkConnection() {
    let client;
    try {
        client = await pool.connect();
        // Obtiene una conexión del pool.
        await client.query("SELECT 1");
        // Query de ping para verificar que la BD responde.
        return { ok: true, message: "PostgreSQL connected successfully" };
    } catch (error) {
        return { ok: false, message: `Connection error: ${error.message}` };
    } finally {
        if (client) client.release();
        // SIEMPRE devuelve la conexión al pool, incluso si hubo error.
        // Sin esto, el pool se agotaría con conexiones zombie.
    }
}

// Líneas 34-52 (initSchema)
async function initSchema() {
    const sql = `
        CREATE TABLE IF NOT EXISTS users (
            id         SERIAL        PRIMARY KEY,
            -- SERIAL = auto-incremento (1, 2, 3...)
            
            username   VARCHAR(512)  NOT NULL UNIQUE,
            -- VARCHAR(512) permite nombres largos. UNIQUE previene duplicados.
            
            email      VARCHAR(255)  NOT NULL UNIQUE,
            -- Email único por usuario.
            
            password   VARCHAR(512)  NOT NULL,
            -- Almacena el hash (no la contraseña), formato: "salt:hash" en hex.
            -- 512 chars es suficiente para scrypt (32 hex salt + 128 hex hash + separador).
            
            created_at TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
            -- TIMESTAMPTZ incluye timezone → no hay ambigüedad en deploys multi-timezone.
        );
    `;
    await pool.query(sql);
    // CREATE TABLE IF NOT EXISTS = idempotente → seguro de llamar en cada arranque.
}
```

---

### `middlewares/cors-middleware.js` — Control CORS

```javascript
// Líneas 5-15 (ALLOWED_ORIGINS)
const ALLOWED_ORIGINS = [
    "http://localhost",        // Nginx en puerto 80 (default, sin puerto explícito)
    "http://localhost:80",     // Nginx en puerto 80 (con puerto explícito)
    "http://localhost:3000",   // Acceso directo al backend (desarrollo)
    "http://localhost:8080",   // Puerto alternativo de desarrollo
    "http://127.0.0.1",        // Loopback IPv4
    "http://127.0.0.1:80",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
    "null",                    // Archivos locales: algunos browsers envían "null" como Origin
];
// Lista blanca de orígenes permitidos.
// Solo peticiones de estos orígenes pueden acceder a la API.

// Líneas 18-23 (orígenes dinámicos)
if (process.env.FRONTEND_URL) {
    ALLOWED_ORIGINS.push(process.env.FRONTEND_URL);
}
if (process.env.SERVER_URL) {
    ALLOWED_ORIGINS.push(process.env.SERVER_URL);
}
// Permite agregar URLs de producción sin hardcoding.
// En docker-compose.yml se pueden descomentar: FRONTEND_URL=http://tu-ip

// Líneas 28-48 (corsMiddleware)
function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    // El header Origin lo envía el browser en requests cross-origin.
    
    if (!origin) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        // Sin Origin = request server-to-server (curl, Postman, etc.) → permite todo.
    } else if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        // Origin en lista blanca → permite ese origen específico.
        // NO se usa "*" porque necesitamos Allow-Credentials.
    }
    // Si el origin no está en la lista → no se setea el header → el browser bloquea.

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    // Allow-Credentials=true permite el envío de cookies y Authorization headers.
    // Requiere que Allow-Origin sea un origen específico (no "*").

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
        // Preflight request (browser lo hace antes del POST real).
        // 204 = No Content → está bien, procede.
    }
    
    next();
    // Si no es OPTIONS, continua al siguiente middleware/ruta.
}
```

---

### `middlewares/error-handler.js` — Manejo de Errores

```javascript
// Líneas 4-13 (errorHandler)
function errorHandler(err, req, res, next) {
// 4 parámetros = Express lo identifica como error handler (no como ruta normal).

    const status = err.status || err.statusCode || 500;
    // Usa el código de status del error si existe, sino 500 (Internal Server Error).
    
    const message = err.message || "Internal server error";
    
    console.error(`[ERROR] ${req.method} ${req.path}`, err.message);
    // Log del error con contexto (método HTTP + ruta).
    
    res.status(status).json({ ok: false, error: message });
    // Respuesta consistente: siempre JSON con campos 'ok' y 'error'.
}

// Líneas 19-24 (notFound)
function notFound(req, res) {
    res.status(404).json({
        ok: false,
        error: `Route not found: ${req.method} ${req.originalUrl}`,
        // Incluye el método y la ruta en el mensaje → facilita debugging.
    });
}
```

---

### `services/encryption.service.js` — Criptografía de Contraseñas

```javascript
// Línea 1
const crypto = require("crypto");
// Módulo nativo de Node.js para operaciones criptográficas.
// NO requiere instalación de dependencias externas.

// Líneas 3-5
const SCRYPT_KEYLEN = 64;       // 64 bytes = 512 bits → hash de contraseña
const SCRYPT_SALT_LEN = 16;     // 16 bytes = 128 bits → sal aleatoria
const SEPARATOR = ":";           // Separador entre salt y hash en el string guardado

// Líneas 10-18 (hashPassword)
async function hashPassword(plainPassword) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(SCRYPT_SALT_LEN);
        // Genera 16 bytes aleatorios criptográficamente seguros.
        // Cada usuario tiene una sal única → mismo password = hashes diferentes.
        
        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, hash) => {
            // scrypt: función de derivación de claves diseñada para ser resistente
            // a ataques de fuerza bruta con hardware especializado (GPUs/ASICs).
            // Parámetros: password, salt, longitud del hash, callback.
            
            resolve(`${salt.toString("hex")}${SEPARATOR}${hash.toString("hex")}`);
            // Formato guardado: "a1b2c3...d4e5f6:hash1hash2hash3..."
            // La sal se guarda junto al hash para poder verificar después.
        });
    });
}

// Líneas 23-40 (verifyPassword)
async function verifyPassword(plainPassword, storedHash) {
    return new Promise((resolve, reject) => {
        const [saltHex, hashHex] = storedHash.split(SEPARATOR);
        // Separa la sal del hash usando el separador ":".
        
        const salt = Buffer.from(saltHex, "hex");
        const expectedHash = Buffer.from(hashHex, "hex");
        // Convierte los strings hex a buffers binarios para la comparación.
        
        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, derivedHash) => {
            // Re-deriva el hash usando el mismo salt y la contraseña provista.
            
            resolve(crypto.timingSafeEqual(derivedHash, expectedHash));
            // timingSafeEqual: compara en tiempo constante → previene timing attacks.
            // Un timing attack mide cuánto tarda el === para deducir el hash.
            // timingSafeEqual siempre tarda lo mismo independiente de cuántos bytes coincidan.
        });
    });
}
```

---

### `services/zip.service.js` — Manejo de ZIPs

```javascript
// Línea 1
const admZip = require("adm-zip");
// adm-zip: librería para crear y extraer ZIPs en Node.js sin dependencias externas.

// Líneas 3-9 (zipFiles)
const zipFiles = async (sourceDir, outputFilePath) => {
    const zip = new admZip();
    zip.addLocalFolder(sourceDir);
    // Agrega TODOS los archivos del directorio al ZIP (recursivo).
    
    await zip.writeZipPromise(outputFilePath);
    // Escribe el ZIP a disco de forma asíncrona.
    
    return `Zip file created: ${outputFilePath}`;
};

// Líneas 11-20 (unzipFiles)
const unzipFiles = async (inputFilePath, outputDirectory) => {
    const zip = new admZip(inputFilePath);
    // Carga el ZIP existente desde disco.
    
    return new Promise((resolve, reject) => {
        zip.extractAllToAsync(outputDirectory, true, (error) => {
            // Extrae TODOS los archivos al directorio de destino.
            // true = sobreescribir si ya existen.
            if (error) return reject(error);
            resolve(`Extracted to "${outputDirectory}" successfully`);
        });
    });
};
```

---

### `controllers/auth.controller.js` — Autenticación

```javascript
// Líneas 7-25 (logIn)
const logIn = async (req, res) => {
    const { email, password } = req.body;
    // Extrae credenciales del body (parseado por express.json()).

    const result = await db.pool.query(
        `SELECT * FROM users WHERE email = $1`,
        [email]
    );
    // Query parametrizada → previene SQL Injection.
    // $1 es un placeholder para el valor email.
    
    const user = result.rows[0];
    // rows[0] = primer resultado (o undefined si no existe).
    
    if (!user || !(await enc.verifyPassword(password, user.password))) {
        return res.status(401).send({ message: "Credenciales incorrectas" });
    }
    // Doble verificación: usuario existe Y contraseña correcta.
    // El mensaje es genérico → no revela si el email existe o no (seguridad).
    
    delete user.password;
    // CRÍTICO: elimina el hash de contraseña antes de enviar el usuario al frontend.
    // El hash nunca debe salir del servidor.
    
    res.status(200).send(user);
    // Envía el objeto usuario (sin password) → el frontend lo guarda en localStorage.
};

// Líneas 31-55 (register)
const register = async (req, res) => {
    const { username, email, password } = req.body;

    const duplicates = await db.pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [email]
    );
    if (duplicates.rows[0]) {
        return res.status(409).send({ message: "Duplicated Credentials" });
        // 409 Conflict → email ya registrado.
        // Solo pide id para hacer la query más eficiente (no trae todos los campos).
    }

    const hashedPassword = await enc.hashPassword(password);
    // Hashea con scrypt antes de insertar en BD.

    const result = await db.pool.query(
        `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email`,
        [username, email, hashedPassword]
    );
    // RETURNING devuelve los campos especificados del registro insertado.
    // Solo retorna id, username, email → NO retorna el hash de contraseña.
    
    res.status(200).send({ message: "¡Cuenta creada con éxito!", user: result.rows[0] });
};
```

---

### `controllers/uploads.controller.js` — Orquestador IA

```javascript
// Líneas 7-35 (runPythonScript)
const runPythonScript = (scriptPath, args) => {
    return new Promise((resolve, reject) => {
        const pyProg = spawn('python', [scriptPath, ...args], {
            cwd: path.resolve(__dirname, '../../ai')
            // Ejecuta Python con el directorio de trabajo en /ai.
            // Esto es CRÍTICO porque main.py hace imports relativos
            // (from config import ...) que necesitan estar en el PYTHONPATH.
        });

        pyProg.stdout.on('data', (data) => {
            console.log(`[AI-Process stdout]: ${data.toString().trim()}`);
            // Captura y loggea el stdout del proceso Python (print() del AI).
        });

        pyProg.stderr.on('data', (data) => {
            console.error(`[AI-Process stderr]: ${data.toString().trim()}`);
            // stderr en Python incluye tanto errores como warnings de transformers.
            // No siempre es un error real → por eso solo se loggea.
        });

        pyProg.on('close', (code) => {
            if (code === 0) {
                resolve();
                // Exit code 0 = éxito.
            } else {
                reject(new Error(`AI Process failed with code: ${code}`));
                // Cualquier otro código = proceso fallido.
            }
        });
    });
};

// Líneas 37-156 (uploadZip — función principal)
const uploadZip = async (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: "No file uploaded..." });
        // Multer pone el archivo en req.file. Si está undefined → no se subió nada.
    }

    // PASO 1: Descomprimir
    const extractTimestamp = Date.now();
    const extractPath = path.resolve(__dirname, `../uploads/unzip_${extractTimestamp}`);
    fs.mkdirSync(extractPath, { recursive: true });
    await unzipFiles(req.file.path, extractPath);
    // req.file.path = ruta temporal donde Multer guardó el ZIP.
    // Se descomprime en un directorio único (con timestamp) para evitar colisiones.
    
    if (fs.existsSync(req.file.path)) {
        fs.rmSync(req.file.path, { force: true });
    }
    // Elimina el ZIP original inmediatamente después de extraer → ahorra espacio.

    // PASO 2: Encontrar datasets recursivamente
    const getAllFiles = (dir, fileList = []) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                getAllFiles(filePath, fileList);
                // Recursión para subdirectorios.
            } else {
                fileList.push(filePath);
            }
        }
        return fileList;
    };
    
    const dataFiles = extractedFiles.filter(f =>
        f.endsWith('.csv') || f.endsWith('.json') || f.endsWith('.parquet') || f.endsWith('.jsonl')
    );
    // Filtra solo archivos de datos válidos. Ignora .txt, .md, etc.

    if (dataFiles.length === 0) {
        fs.rmSync(extractPath, { recursive: true, force: true });
        return res.status(400).send({ message: "No valid dataset files found..." });
        // Cleanup + error si el ZIP no contenía datos válidos.
    }

    // PASO 3: Preparar ejecución IA
    const aiScriptPath = path.resolve(__dirname, '../../ai/main.py');
    const downloadsDir = path.resolve(__dirname, '../downloads');
    const textCol  = req.body.text_column  || 'sample';
    const labelCol = req.body.label_column || 'emotion';
    // Lee parámetros opcionales del form-data. Valores por defecto si no se envían.

    // PASO 4: Ejecutar IA secuencialmente por cada dataset
    for (const dataFilePath of dataFiles) {
        try {
            await runPythonScript(aiScriptPath, [
                '--data', dataFilePath,
                '--task', 'text-classification',
                '--text-column', textCol,
                '--label-column', labelCol
            ]);
        } catch (pyErr) {
            console.error(`Error processing file ${dataFilePath}:`, pyErr);
            // Si un dataset falla, continúa con el siguiente (no aborta todo).
        }
    }
    // Secuencial (no paralelo) para evitar OOM con múltiples modelos en GPU al mismo tiempo.

    fs.rmSync(extractPath, { recursive: true, force: true });
    // Cleanup de los archivos extraídos después de que la IA los procesó.

    // PASO 5: Comprimir output de la IA
    const aiOutputDir = path.resolve(__dirname, '../../ai/poison_ai_output');
    if (!fs.existsSync(aiOutputDir)) {
        return res.status(500).send({ message: "AI output folder not found." });
    }
    
    const outputZipPath = path.resolve(downloadsDir, `poison_ai_reports_${Date.now()}.zip`);
    await zipFiles(aiOutputDir, outputZipPath);
    // Zip toda la carpeta de output de la IA.

    // PASO 6: Enviar ZIP al browser
    res.download(outputZipPath, 'poison_ai_reports.zip', (err) => {
        if (err) console.error("Error sending file:", err);
        
        // Cleanup DESPUÉS de enviarlo (en el callback de download)
        if (fs.existsSync(outputZipPath)) fs.rmSync(outputZipPath, { force: true });
        if (fs.existsSync(aiOutputDir)) fs.rmSync(aiOutputDir, { recursive: true, force: true });
        // Es importante hacer el cleanup en el callback, no antes,
        // porque res.download() es asíncrono (streaming del archivo).
    });
};
```

---

### `routes/uploads.route.js` — Ruta de Uploads

```javascript
// Línea 2
const multer = require('multer');
// Multer: middleware para manejar multipart/form-data (subida de archivos).

// Línea 6
const upload = multer({ dest: 'uploads/' })
// Configura Multer con destino en la carpeta 'uploads/'.
// Multer genera nombres de archivo aleatorios (sin extensión) para evitar colisiones.

// Línea 8
router.post("/", upload.single('file'), uploadZip)
// upload.single('file') = procesa UN solo archivo del campo 'file'.
// Una vez procesado, lo agrega a req.file y llama al siguiente middleware (uploadZip).
```

---

### `routes/auth.route.js` — Rutas de Auth

```javascript
// Línea 5
router.post("/login/", logIn);
// POST /api/auth/login/ → función logIn del controller

// Línea 6
router.post("/register/", register);
// POST /api/auth/register/ → función register del controller
```

---

## 🐳 Dockerfile del Backend

```dockerfile
FROM node:20-slim
# Node.js 20 LTS en versión slim (sin herramientas de desarrollo extra).

# Instala Python3 y pip para poder ejecutar el script de IA
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Directorio de trabajo dentro del container.

# Copia los archivos de dependencias PRIMERO (para aprovechar cache de Docker layers)
COPY package*.json ./
RUN npm install
# Instala dependencias de Node.js.

# Instala dependencias de Python del módulo AI
COPY /ai/requirements.txt /ai/requirements.txt
RUN pip3 install -r /ai/requirements.txt --break-system-packages

COPY . .
# Copia el resto del código.

EXPOSE 3000
CMD ["node", "index.js"]
```

---

## 📦 Dependencias (`package.json`)

| Paquete | Uso |
|---------|-----|
| `express` | Framework HTTP/REST |
| `pg` | Cliente PostgreSQL (node-postgres) |
| `multer` | Subida de archivos multipart |
| `adm-zip` | Comprimir/descomprimir ZIP |
| `dotenv` | Carga de variables de entorno |
| `cors` | (Disponible, se usa middleware propio) |