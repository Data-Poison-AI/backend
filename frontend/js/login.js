 function toggleAuth() {
            document.getElementById('login-container').classList.toggle('hidden');
            document.getElementById('register-container').classList.toggle('hidden');
        }

        function togglePassword(inputId, btn) {
            const input = document.getElementById(inputId);
            const icon  = btn.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        }

       

        // --- SIMULACIÓN DE BASE DE DATOS JSON CON LOCALSTORAGE ---
        const DB_KEY = 'datapoison_users';

        function getUsers() {
            const data = localStorage.getItem(DB_KEY);
            return data ? JSON.parse(data) : [];
        }

        function saveUser(user) {
            const users = getUsers();
            users.push(user);
            localStorage.setItem(DB_KEY, JSON.stringify(users));
        }

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name        = document.getElementById('reg-name').value;
            const email       = document.getElementById('reg-email').value;
            const password    = document.getElementById('reg-password').value;
            const confirmPass = document.getElementById('reg-confirm-password').value;

            if (password !== confirmPass) {
                alert("Las contraseñas no coinciden.");
                return;
            }
            const users = getUsers();
            if (users.find(u => u.email === email)) {
                alert("Este email ya está registrado.");
                return;
            }
            saveUser({ name, email, password });
            alert("¡Cuenta creada con éxito! Ahora puedes iniciar sesión.");
            toggleAuth();
        });

        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email    = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const users    = getUsers();
            const user     = users.find(u => u.email === email && u.password === password);


            // redireccio al scanner
            if (user) {
                alert(`Bienvenido de nuevo, ${user.name}`);
                window.location.href = 'scanner.html';
            } else {
                alert("Credenciales incorrectas. Inténtalo de nuevo.");
            }
        });