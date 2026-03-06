# Data Poison AI — Backend

A robust REST API for authentication featuring multi-layered encryption for sensitive data. Built with **Node.js**, **Express**, and **PostgreSQL**.

---

## Key Features

This project provides a secure registration and login system where **sensitive data is never stored in plain text**:

| Field      | Storage Format                  | Algorithm         | Reversible?  |
|------------|---------------------------------|-------------------|--------------|
| `username` | Ciphertext (`iv:tag:cipher`)    | AES-256-GCM       | Yes (Server Key) |
| `password` | Hash (`salt:hash`)              | scrypt            | No           |
| `email`    | Plain text                      | —                 | — (Required for login) |

---

## Prerequisites

- **Node.js** v18 or superior
- **PostgreSQL** (local or containerized)
- **npm** (Node Package Manager)

---

## Installation & Setup

### 1. Install Dependencies & Initialize Database

```bash
# Clone and enter the directory
cd backend

# Install production and development dependencies
npm i express pg dotenv
npm i --save-dev nodemon

# Spin up a PostgreSQL container (Optional)
docker run --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=your_secure_password -d postgres
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory and configure the following variables:

```env
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
PORT=3000
FRONTEND_URL=http://localhost:5500
ENCRYPTION_KEY=<your_64_character_hex_key>
```

To generate a new `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> [!WARNING]
> If you change the `ENCRYPTION_KEY`, all existing usernames in the database will become undecipherable. **Never commit your `.env` file to version control.**

---

### 3. Run the Server

```bash
# Start in development mode (with hot-reload)
npm run dev
```

**Expected Output:**
```text
Database: PostgreSQL connected successfully
Schema initialized, users table verified.
[SERVER] Data Poison AI API running at http://localhost:3000
```

---

## API Documentation

### User Registration
`POST /api/register/`

**Request Body:**
```json
{
  "username": "UserOne",
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Responses:**
- `200 OK`: `{ "message": "Successfully Registered" }`
- `409 Conflict`: `{ "message": "Duplicated Credentials" }`

---

### User Login
`POST /api/login/`

**Request Body:**
```json
{
  "username": "UserOne",
  "password": "securepassword123"
}
```

**Responses:**
- `200 OK`: returns the user object (excluding password hash).
- `401 Unauthorized`: `"Incorrect Credentials"`

---

## Project Structure

```text
backend/
├── index.js                # Entry point: initializes Express and Server
├── .gitignore              # Files ignored by Git
├── package.json            # Dependencies and scripts
├── README.md               # Documentation
│
├── controllers/            # Request handlers (Login, Register)
│   └── auth.controller.js
│
├── models/                 # Database schema and connection pool
│   └── db.model.js
│
├── routes/                 # Endpoint definitions
│   └── auth.route.js
│
├── middlewares/            # Custom logic (CORS, Error Handling)
│   ├── cors-middleware.js
│   └── error-handler.js
│
├── services/               # Core business logic (Encryption/Hashing)
│   └── encryption.js
└── .env                    # Environment configuration (Local only)
```

---

## Tech Stack Dependencies

| Package   | Version  | Purpose                                   |
|-----------|----------|-------------------------------------------|
| `express` | ^5.2.1   | HTTP framework for routes and middleware  |
| `pg`      | ^8.20.0  | PostgreSQL client with Connection Pooling |
| `dotenv`  | ^17.3.1  | Environment variable management           |
| `nodemon` | ^3.1.14  | Development auto-restart                  |

---

*This project is part of the Data Poison AI ecosystem.*