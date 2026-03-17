# 🌐 Módulo Frontend — Data Poison AI

El frontend es una **SPA (Single-Page Application) estática** servida por Nginx. Está construido con HTML5, CSS Vanilla y JavaScript puro, usando Tailwind CSS (CDN) y Bootstrap para estilos adicionales. Nginx actúa como reverse proxy redirigiendo las llamadas `/api/*` al backend de Node.js.

---

## 📁 Estructura del Módulo

```
frontend/
├── Dockerfile              ← Imagen Docker de Nginx
├── nginx.conf              ← Configuración del servidor web y reverse proxy
│
├── html/
│   ├── index.html          ← Landing page pública (inicio)
│   ├── login.html          ← Formulario de login y registro
│   ├── scanner.html        ← Dashboard principal (requiere auth)
│   ├── docs.html           ← Documentación pública
│   └── contacto.html       ← Formulario de contacto
│
├── css/
│   └── styles.css          ← Estilos globales, glassmorphism, animaciones
│
└── js/
    ├── index.js            ← Inicializa AOS (animaciones on scroll)
    ├── login.js            ← Lógica de autenticación (registro/login)
    ├── scanner.js          ← Lógica del dashboard de análisis
    └── docs.js             ← Resaltado de sección activa en la sidebar
```

---

## 🗺️ Mapa de Navegación

```
/ (raíz)
    │
    ▼
/html/index.html        ← Landing page pública
    ├── → /html/login.html       (botón "Iniciar Sesión")
    ├── → /html/scanner.html     (botón "Probar la IA")
    └── → /html/docs.html        (botón "Documentación")

/html/login.html        ← Página de autenticación
    └── → /html/scanner.html     (login exitoso → redirect automático)

/html/scanner.html      ← Dashboard (protegido con localStorage)
    └── → /html/login.html       (si no hay sesión → redirect automático)
```

---

## 🔐 Sistema de Autenticación Frontend

No usa tokens JWT de servidor. Usa **localStorage** del navegador:

- **Login exitoso** → La respuesta del backend (objeto usuario) se serializa como JSON y se guarda en `localStorage.setItem('user', JSON.stringify(data))`.
- **Protección de rutas** → En cada página protegida (`scanner.html`), el `window.onload` verifica si existe el item `'user'` en localStorage. Si no existe, redirige a `login.html`.
- **Logout** → `localStorage.removeItem('user')` + redirect a `login.html`.

---

## 🌐 Flujo de Comunicación con el Backend

```
Browser (frontend JS)
      │
      │  fetch('/api/auth/login', { method: 'POST', ... })
      │  fetch('/api/uploads',    { method: 'POST', ... })
      ▼
Nginx (puerto 80)
      │
      │  location /api/ → proxy_pass http://backend:3000/api/
      ▼
Node.js Backend (puerto 3000, container "backend")
      │
      ├── POST /api/auth/login    → AuthController.logIn()
      ├── POST /api/auth/register → AuthController.register()
      └── POST /api/uploads       → UploadController.uploadZip()
                                         │
                                         ▼
                                   Python AI (subprocess)
                                         │
                                         ▼
                                   ZIP de reportes → res.download()
```

---

## 📄 Análisis Línea por Línea

---

### `nginx.conf` — Servidor Web y Reverse Proxy

```nginx
# Línea 1
server {
# Bloque de servidor: define una instancia del servidor virtual.

# Línea 2
listen 80;
# Nginx escucha en el puerto 80 (HTTP estándar).
# El docker-compose mapea el puerto 80 del container al 80 del host.

# Línea 3
server_name localhost;
# Nombre del servidor. Acepta peticiones con Host: localhost.

# Línea 6
client_max_body_size 200M;
# Tamaño máximo de request permitido: 200 megabytes.
# Sin esto, los ZIPs grandes serían rechazados con error 413.

# Línea 9
root /usr/share/nginx/html;
# Directorio raíz para servir archivos estáticos.
# El Dockerfile copia el frontend aquí.

# Línea 10
index html/index.html;
# Archivo por defecto cuando se accede a un directorio.

# Líneas 13-15 (redirect de raíz)
location = / {
    return 301 /html/index.html;
}
# Redirect permanente: '/' → '/html/index.html'.
# El '=' significa match exacto (solo para '/').

# Líneas 18-20 (archivos estáticos)
location / {
    try_files $uri $uri/ =404;
}
# Para cualquier otra ruta:
# 1. Intenta servir el archivo exacto ($uri)
# 2. Intenta servir como directorio ($uri/)
# 3. Si nada existe → 404

# Líneas 23-43 (reverse proxy API)
location /api/ {
    proxy_pass http://backend:3000/api/;
    # Redirige todas las peticiones /api/* al container "backend" en el puerto 3000.
    # "backend" es el nombre del service en docker-compose → DNS interno de Docker.

    proxy_http_version 1.1;
    # Usa HTTP/1.1 para soporte de conexiones keep-alive.

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    # Cabeceras para soporte de WebSockets (futuras features).

    proxy_set_header Host $host;
    # Pasa el header Host original al backend.

    proxy_cache_bypass $http_upgrade;
    # Desactiva cache cuando hay upgrade (WebSocket).

    proxy_read_timeout 600s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 600s;
    # Timeouts extendidos a 10 minutos.
    # El proceso de IA puede tardar varios minutos con datasets grandes.
    # Sin esto, Nginx cortaría la conexión antes de que el AI termine.

    client_max_body_size 200M;
    # Repetido aquí para garantizar que el limit aplica también en el bloque /api/.

    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Cabeceras de seguridad/forwarding: pasan la IP real del cliente al backend.
}
```

---

### `js/index.js` — Script de la Landing Page

```javascript
// Línea 2
AOS.init({ duration: 1000, once: true });
// Inicializa AOS (Animate On Scroll) con:
// - duration: 1000ms de duración por animación
// - once: true → cada animación solo ocurre una vez (no se repite al hacer scroll back)
// Activa los atributos data-aos="fade-right", data-aos="zoom-in" etc. del HTML.
```

---

### `js/login.js` — Autenticación

```javascript
// Línea 2-5 (toggleAuth)
function toggleAuth() {
    document.getElementById('login-container').classList.toggle('hidden');
    document.getElementById('register-container').classList.toggle('hidden');
}
// Alterna entre el formulario de login y el de registro.
// classList.toggle('hidden') agrega o quita la clase 'hidden' de Tailwind.
// Solo uno de los dos contenedores es visible a la vez.

// Líneas 8-18 (togglePassword)
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}
// Muestra/oculta la contraseña cambiando el type del input.
// También cambia el ícono de Font Awesome entre ojo abierto y cerrado.

// Línea 20
const API_BASE_URL = '/api/auth';
// URL base para las peticiones de autenticación.
// Usa ruta relativa → Nginx la convierte a http://backend:3000/api/auth.
// En producción esto funciona sin cambios, independiente del dominio.

// Líneas 23-53 (register)
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Previene la recarga de página del submit HTML tradicional.
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('reg-confirm-password').value;
    // Extrae valores de los campos del formulario de registro.

    if (password !== confirmPass) {
        alert("Las contraseñas no coinciden.");
        return;
    }
    // Validación client-side: verificar que las contraseñas coinciden antes de enviar.

    const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, email, password })
    });
    // POST al endpoint de registro con el body en JSON.
    // El backend hasheará la contraseña antes de guardar en BD.

    if (response.ok) {
        toggleAuth();
        // Si el registro fue exitoso, muestra el formulario de login.
    } else {
        alert(data.message || "Error al registrar la cuenta.");
    }
});

// Líneas 58-85 (login)
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    // El backend devuelve el objeto usuario (sin password) si las credenciales son correctas.

    if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data));
        // Guarda el objeto usuario en localStorage para persistir la sesión.
        
        window.location.href = 'scanner.html';
        // Redirige al dashboard de análisis.
    } else {
        alert("Credenciales incorrectas. Inténtalo de nuevo.");
    }
});
```

---

### `js/scanner.js` — Dashboard de Análisis

```javascript
// Líneas 3-19 (switchView)
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    // Oculta todas las secciones quitando la clase 'active'.
    
    document.getElementById(viewId).classList.add('active');
    // Muestra solo la sección con el ID indicado.

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active-nav-btn');
        btn.classList.add('text-gray-400');
        btn.style.color = '';
    });
    // Resetea todos los botones de navegación a su estado inactivo.

    const activeBtnId = viewId.replace('view-', 'nav-');
    // Transforma "view-scanner" → "nav-scanner" para encontrar el botón correspondiente.
    
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('active-nav-btn');
        // Aplica estilos de "activo" al botón de la vista actual.
    }
}

// Líneas 22-39 (toggleSidebar)
let isCollapsed = false;  // Estado de la sidebar en variable módulo.

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('collapse-icon');
    const texts = document.querySelectorAll('.sidebar-text');
    
    isCollapsed = !isCollapsed;
    // Toggle del estado.

    if (isCollapsed) {
        sidebar.classList.replace('w-72', 'w-24');
        // Reduce del ancho 72 (≈288px) a 24 (≈96px) — solo iconos.
        icon.classList.replace('fa-chevron-left', 'fa-chevron-right');
        // Invierte la dirección del ícono de flecha.
        texts.forEach(t => t.classList.add('hidden'));
        // Oculta todos los textos de la sidebar (quedan solo iconos).
    } else {
        sidebar.classList.replace('w-24', 'w-72');
        
        setTimeout(() => texts.forEach(t => t.classList.remove('hidden')), 200);
        // Espera 200ms antes de mostrar textos → da tiempo a la animación CSS
        // de la sidebar de expandirse antes de aparecer el texto.
    }
}

// Líneas 50-58 (selectType)
function selectType(type) {
    document.querySelectorAll('.type-card').forEach(c => {
        c.classList.remove('type-selected-purple', 'type-selected-green', 'type-selected-blue');
    });
    // Quita el estilo "seleccionado" de todas las tarjetas de tipo.
    
    const selected = document.getElementById(`type-${type}`);
    if (type === 'image') selected.classList.add('type-selected-purple');
    if (type === 'code')  selected.classList.add('type-selected-green');
    if (type === 'text')  selected.classList.add('type-selected-blue');
    // Aplica el color correspondiente al tipo seleccionado.
}

// Líneas 60-95 (Drop Zone)
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.onclick = (e) => {
    if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) fileInput.click();
};
// Clic en la zona de drag-drop → abre el file picker del navegador.
// La condición evita el conflicto con botones internos al dropZone.

dropZone.ondragover = (e) => {
    e.preventDefault();  // Necesario para permitir el drop.
    dropZone.style.borderColor = 'rgba(0,230,118,0.5)';
    dropZone.style.boxShadow = '0 0 30px rgba(0,230,118,0.08)';
    // Efecto visual de feedback: el borde se vuelve verde al arrastrar.
};

dropZone.ondragleave = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(192,132,252,0.3)';
    dropZone.style.boxShadow = '';
    // Restaura los estilos originales al salir del área de drop.
};

dropZone.ondrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        // Asigna los archivos soltados al input oculto.
        fileInput.dispatchEvent(new Event('change'));
        // Dispara el evento 'change' manualmente para activar fileInput.onchange.
    }
};

fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
        document.getElementById('upload-prompt').classList.add('hidden');
        document.getElementById('file-info').classList.remove('hidden');
        document.getElementById('selected-filename').innerText = e.target.files[0].name;
        // Muestra el nombre del archivo seleccionado y oculta el mensaje inicial.
    }
};

// Líneas 97-180 (processAnalysis) — FUNCIÓN PRINCIPAL
async function processAnalysis(event) {
    event.stopPropagation();
    // Evita que el clic se propague al dropZone (que abriría el file picker).

    const file = fileInput.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.zip')) {
        alert("Por favor selecciona un archivo .zip.");
        return;
    }
    // Validación básica: el archivo debe existir y ser un ZIP.

    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('scanning-loader').classList.remove('hidden');
    // Oculta la info del archivo y muestra el loader animado.

    const formData = new FormData();
    formData.append('file', file);
    // Crea un FormData con el archivo. Multer en el backend lo espera
    // como campo 'file' (configurado en uploads.route.js).

    const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
        // NO se especifica Content-Type → el navegador lo hace automáticamente
        // con el boundary correcto para multipart/form-data.
    });

    if (!response.ok) {
        // Manejo de error con múltiples intentos:
        // 1. Intenta parsear como JSON (mensaje estructurado)
        // 2. Si falla, lee como texto plano
        let errorMessage = "Error en el análisis al procesar IA";
        try {
            const data = await response.json();
            if (data && data.message) errorMessage = data.message;
        } catch (e) {
            const txt = await response.text();
            if (txt) errorMessage = txt;
        }
        throw new Error(errorMessage);
    }

    const blob = await response.blob();
    // El backend responde con el ZIP de reportes como blob binario.
    
    const downloadUrl = window.URL.createObjectURL(blob);
    // Crea una URL temporal de objeto en memoria para el blob.
    // Esta URL es válida solo en la sesión actual del navegador.

    document.getElementById('scanning-loader').classList.add('hidden');
    document.getElementById('drop-zone').classList.add('hidden');
    document.getElementById('result-container').classList.remove('hidden');
    // Alterna la UI: oculta loader y dropzone, muestra el contenedor de resultados.

    const downloadBtn = document.getElementById('download-report-btn');
    downloadBtn.classList.remove('hidden');
    downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `Reporte_${file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Técnica estándar para forzar la descarga de un blob:
        // crear un enlace temporal, hacer clic programáticamente, eliminarlo.
    };

    // Actualizar el historial en la tabla
    const tbody = document.getElementById('history-table-body');
    const newRow = `
        <tr>
            <td>${file.name}</td>
            <td>Justo ahora</td>
            <td>Exitoso</td>
            <td>82%</td>    <!-- Placeholder: valor fijo -->
            <td>Detectado</td>
        </tr>
    `;
    tbody.insertAdjacentHTML('afterbegin', newRow);
    // insertAdjacentHTML('afterbegin') inserta al principio → el más reciente aparece primero.
}

// Líneas 182-194 (resetScanner)
function resetScanner() {
    document.getElementById('result-container').classList.add('hidden');
    document.getElementById('drop-zone').classList.remove('hidden');
    document.getElementById('upload-prompt').classList.remove('hidden');
    // Restaura la UI al estado inicial.

    const downloadBtn = document.getElementById('download-report-btn');
    downloadBtn.classList.add('hidden');
    downloadBtn.onclick = null;
    // Limpia el botón de descarga y su event listener.

    fileInput.value = '';
    // Limpia el file input → permite volver a seleccionar el mismo archivo.
}

// Líneas 196-245 (window.onload) — Inicialización del Dashboard
window.onload = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'login.html';
        return;
    }
    // Guard: si no hay usuario en localStorage → redirigir a login.
    // Protege las páginas de acceso no autorizado (sin backend).

    const user = JSON.parse(userStr);
    
    document.getElementById('user-display-name').innerText = user.username || 'Usuario';
    // Muestra el nombre de usuario en la sidebar.

    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=00e676&color=07040f&bold=true&size=128`;
    // ui-avatars.com genera avatares con iniciales del nombre.
    // encodeURIComponent maneja caracteres especiales en el nombre.
    // Los colores usan el brand: fondo verde (#00e676), texto oscuro (#07040f).
    
    document.getElementById('profile-avatar').src = avatarUrl;
    document.getElementById('profile-name').innerText = user.username;
    document.getElementById('profile-email').innerText = user.email;
    
    if (user.created_at) {
        const date = new Date(user.created_at);
        document.getElementById('profile-joined').innerText = 
            date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        // Formatea la fecha en español: "16 de marzo de 2026".
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        // Logout: limpia localStorage y redirige al login.
    });
};
```

---

### `js/docs.js` — Navegación de Documentación

```javascript
document.addEventListener('DOMContentLoaded', function() {
// Espera a que el DOM esté completamente cargado antes de agregar listeners.

    function highlightNavOnScroll() {
        let scrollY = window.scrollY;
        sections.forEach(current => {
            const sectionTop = current.offsetTop - 100;
            // offsetTop: posición vertical del elemento desde el top del documento.
            // -100px de offset para activar la sección ligeramente antes de llegar a ella.
            
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                // Si el scroll está dentro del rango de esta sección:
                navLinks.forEach(link => link.classList.remove('active'));
                let activeLink = document.querySelector(`.sidebar-link[href*="${sectionId}"]`);
                if (activeLink) activeLink.classList.add('active');
                // Marca el enlace correspondiente como activo en la sidebar.
            }
        });
    }
    window.addEventListener('scroll', highlightNavOnScroll);
    // Escucha el evento scroll (se dispara muchas veces por segundo).
    
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navLinks.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            // Al hacer clic en un enlace, lo marca activo inmediatamente sin
            // esperar al evento scroll.
        });
    });
});
```

---

### `html/index.html` — Landing Page

**Estructura de secciones:**

| Sección | Propósito |
|---------|----------|
| `<nav>` | Navbar sticky con glassmorphism |
| Hero | Título + descripción + stats + tarjeta demo |
| Tecnologías | Grid de tarjetas con íconos de capacidades |
| Problemas | Cards detallando amenazas que resuelve el producto |
| CTA | Call-to-action con fondo con blur radial |
| `<footer>` | Links de producto, legal y contacto |

**Sistema de i18n (internacionalización):**

```javascript
const translations = { es: { ... }, en: { ... } };
let currentLang = 'es';  // Idioma por defecto: español

function toggleLang() {
    currentLang = currentLang === 'es' ? 'en' : 'es';
    // Alterna entre español e inglés.
    
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (t[key] !== undefined) {
            if (el.innerHTML.includes('<')) {
                el.innerHTML = t[key];  // Si contiene HTML → usar innerHTML
            } else {
                el.textContent = t[key]; // Si es texto plano → usar textContent (más seguro)
            }
        }
    });
    // Recorre todos los elementos con atributo data-t y actualiza su texto.
    // El atributo data-t actúa como clave de traducción.
}
```

---

## 🐳 Dockerfile del Frontend

```dockerfile
FROM nginx:alpine
# Imagen base ultra-ligera de Nginx (~25MB vs ~140MB de nginx:latest).

COPY . /usr/share/nginx/html
# Copia todos los archivos del frontend al directorio de Nginx.

COPY nginx.conf /etc/nginx/conf.d/default.conf
# Sobreescribe la configuración por defecto de Nginx con la nuestra.

EXPOSE 80
# Documenta que el container usa el puerto 80 (informativo, no abre el puerto).
```

> **Nota**: En el `docker-compose.yml` se montan los archivos como volúmenes (`-v ./frontend:/usr/share/nginx/html`), por lo que los cambios en el frontend se reflejan inmediatamente sin reconstruir la imagen.
