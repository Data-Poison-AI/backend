# Data Poison AI — Backend.

API REST de autenticación con cifrado de datos sensibles, construida con **Node.js**, **Express** y **PostgreSQL**.

---

## ¿Qué hace este proyecto?

Provee un sistema de registro e inicio de sesión donde **ningún dato sensible se almacena en texto plano**:

| Campo      | Almacenado como                  | Algoritmo         | ¿Reversible? |
|------------|----------------------------------|-------------------|--------------|
| `username` | Texto cifrado (`iv:tag:cipher`)  | AES-256-GCM       | Sí (con clave del servidor) |
| `password` | Hash (`salt:hash`)               | scrypt            | No        |
| `email`    | Texto plano                      | —                 | — (necesario para login) |


## Requisitos previos

- **Node.js** v18 o superior
- **PostgreSQL** corriendo en localhost
- **npm** instalado

---

## Instalación y uso

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar variables de entorno

El archivo `.env` ya incluido contiene la configuración base. Verifica que los datos de PostgreSQL sean correctos:

```env
DB_USER=postgres
DB_PASSWORD=tu_contraseña
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
PORT=3000
FRONTEND_URL=http://localhost:5500
ENCRYPTION_KEY=<clave_hex_de_64_caracteres>
```

Para generar una `ENCRYPTION_KEY` nueva:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Si cambias la `ENCRYPTION_KEY`, todos los usernames en BD quedan indescifables. Nunca la subas a Git.

### 3. Arrancar el servidor

```bash
# Desarrollo (recarga automática con nodemon)
npm run dev

# Producción
node index.js
```

Salida esperada:

```
[DB]  PostgreSQL conectado correctamente
Schema inicializado, tabla users verificada.
[SERVER] Data Poison AI API corriendo en http://localhost:3000
```

> **Nota:** Si el proyecto está en una unidad externa (USB, disco NTFS), instala nodemon globalmente para evitar errores de permisos:
> ```bash
> npm install -g nodemon
> nodemon index.js
> ```

---

## Endpoints disponibles

### `GET /api/` — Health check

Verifica que el servidor y la base de datos estén activos.

```bash
curl http://localhost:3000/api/
```

Respuesta:
```json
{
  "ok": true,
  "service": "Data Poison AI API",
  "database": "PostgreSQL conectado correctamente",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

---

### `POST /api/register/` — Registro de usuario

```bash
curl -X POST http://localhost:3000/api/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"Juan Pérez","email":"juan@test.com","password":"123456"}'
```

Respuesta exitosa:
```json
{ "message": "Successfully Registered" }
```

Respuesta si el email ya existe:
```json
{ "message": "Duplicated Credentials" }
```

---

### `POST /api/login/` — Inicio de sesión

El campo `username` debe contener el **email** del usuario.

```bash
curl -X POST http://localhost:3000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"juan@test.com","password":"123456"}'
```

Respuesta exitosa:
```json
[{
  "id": 1,
  "username": "Juan Pérez",
  "email": "juan@test.com",
  "created_at": "2025-01-01T00:00:00.000Z"
}]
```

Respuesta con credenciales incorrectas:
```
Incorrect Credentials
```

---

## Schema de la base de datos

```sql
CREATE TABLE users (
    id                BIGSERIAL     PRIMARY KEY,
    username          VARCHAR(512)  NOT NULL UNIQUE,   -- Cifrado AES-256-GCM
    username_plain    VARCHAR(100)  NOT NULL,           -- Valor original (demostración)
    email             VARCHAR(255)  NOT NULL UNIQUE,
    password          VARCHAR(512)  NOT NULL,           -- Hash scrypt
    password_plain    VARCHAR(255)  NOT NULL,           -- Valor original (demostración)
    created_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
);
```

> Si la tabla ya existe con la estructura antigua, ejecútalo antes de arrancar el servidor:
> ```sql
> DROP TABLE IF EXISTS users;
> ```

---

## Decisiones técnicas clave

**¿Por qué `scrypt` para contraseñas y no `bcrypt`?**
`scrypt` es el algoritmo recomendado por NIST para derivación de contraseñas. Está incluido en Node.js sin dependencias externas y es resistente tanto a ataques de CPU como de GPU.

**¿Por qué `AES-256-GCM` para usernames y no `AES-CBC`?**
GCM (Galois/Counter Mode) provee cifrado autenticado: el authentication tag detecta automáticamente si el dato fue manipulado en la BD. CBC no tiene esta protección.

**¿Por qué IV aleatorio en cada cifrado de username?**
Para que dos usuarios con el mismo nombre produzcan textos cifrados distintos en la BD, eliminando la posibilidad de deducir igualdades por comparación.

**¿Por qué `timingSafeEqual` en la verificación de contraseñas?**
Una comparación normal (`===`) puede tomar más o menos tiempo según cuántos caracteres coinciden, lo que filtra información al atacante (timing attack). `timingSafeEqual` siempre tarda lo mismo.

---

## Dependencias

| Paquete   | Versión  | Uso                                      |
|-----------|----------|------------------------------------------|
| `express` | ^5.2.1   | Framework HTTP para las rutas y middlewares |
| `pg`      | ^8.18.0  | Cliente PostgreSQL con soporte de Pool   |
| `dotenv`  | ^17.3.1  | Carga variables de entorno desde `.env`  |
| `nodemon` | ^3.1.14  | Recarga automática en desarrollo         |

---

## Estructura del proyecto

```
backend/
├── index.js                        # Punto de entrada: configura Express y arranca el servidor
├── .env                            # Variables de entorno (no subir a Git)
├── package.json                    # Dependencias y scripts
├── README.md                       # Este archivo.
│
├── controllers/
│   └── auth.controller.js          # Lógica de login y registro
│
├── models/
│   └── db.model.js                 # Pool de conexión PostgreSQL y definición del schema
│
├── routes/
│   └── auth.route.js               # Definición de endpoints: /login, /register, /health
│
├── middlewares/
│   ├── cors-middleware.js          # Control de orígenes permitidos (CORS)
│   └── error-handler.js            # Captura global de errores y rutas 404
│
└── services/
    └── encryption.js               # Cifrado AES-256-GCM y hashing scrypt
```

---