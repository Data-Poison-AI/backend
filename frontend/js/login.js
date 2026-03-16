
function toggleAuth() {
    document.getElementById('login-container').classList.toggle('hidden');
    document.getElementById('register-container').classList.toggle('hidden');
}

// toggle password visibility
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

// API base URL
const API_BASE_URL = 'http://localhost:3000/api/auth';

// event listeners
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPass = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPass) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: name, email, password })
        });

        const data = await response.json();

        // si el registro es exitoso, mostrar el formulario de login
        if (response.ok) {
            toggleAuth();
        } else {
            alert(data.message || "Error al registrar la cuenta.");
        }
    } catch (error) {
        console.error("Error signing up:", error);
        alert("Error de conexión con el servidor.");
    }
});


// login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // intentar iniciar sesión con las credenciales proporcionadas
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();


        // si el inicio de sesión es exitoso, guardar el usuario en localStorage y redirigir a scanner.html
        if (response.ok) {
            localStorage.setItem('user', JSON.stringify(data));
            window.location.href = 'scanner.html';
        } else {
            alert("Credenciales incorrectas. Inténtalo de nuevo.");
        }
    } catch (error) {
        console.error("Error logging in:", error);
        alert("Error de conexión con el servidor.");
    }
});