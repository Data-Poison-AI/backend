
//  cambiar las vistas
function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active-nav-btn');
        btn.classList.add('text-gray-400');
        btn.style.color = '';
    });

    const activeBtnId = viewId.replace('view-', 'nav-');
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-400');
        activeBtn.classList.add('active-nav-btn');
    }
}

// --- SIDEBAR ---
let isCollapsed = false;
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('collapse-icon');
    const texts = document.querySelectorAll('.sidebar-text');

    isCollapsed = !isCollapsed;

    if (isCollapsed) {
        sidebar.classList.replace('w-72', 'w-24');
        icon.classList.replace('fa-chevron-left', 'fa-chevron-right');
        texts.forEach(t => t.classList.add('hidden'));
    } else {
        sidebar.classList.replace('w-24', 'w-72');
        icon.classList.replace('fa-chevron-right', 'fa-chevron-left');
        setTimeout(() => texts.forEach(t => t.classList.remove('hidden')), 200);
    }
}









// --- SCANNER ---
function selectType(type) {
    document.querySelectorAll('.type-card').forEach(c => {
        c.classList.remove('type-selected-purple', 'type-selected-green', 'type-selected-blue');
    });
    const selected = document.getElementById(`type-${type}`);
    if (type === 'image') selected.classList.add('type-selected-purple');
    if (type === 'code') selected.classList.add('type-selected-green');
    if (type === 'text') selected.classList.add('type-selected-blue');
}

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.onclick = (e) => {
    if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) fileInput.click();
};

dropZone.ondragover = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(0,230,118,0.5)';
    dropZone.style.boxShadow = '0 0 30px rgba(0,230,118,0.08)';
};

dropZone.ondragleave = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(192,132,252,0.3)';
    dropZone.style.boxShadow = '';
};

dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'rgba(192,132,252,0.3)';
    dropZone.style.boxShadow = '';
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
    }
};

fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
        document.getElementById('upload-prompt').classList.add('hidden');
        document.getElementById('file-info').classList.remove('hidden');
        document.getElementById('selected-filename').innerText = e.target.files[0].name;
    }
};

async function processAnalysis(event) {
    event.stopPropagation();

    // agregar alerta bonita
    const file = fileInput.files[0];
    if (!file) {
        alert("Por favor selecciona un archivo .zip.");
        return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
        alert("Por favor selecciona un archivo .zip.");
        return;
    }

    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('scanning-loader').classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', file);

    try {
        // Hacer el POST real al backend
        const response = await fetch('/api/uploads', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            let errorMessage = "Error en el análisis al procesar IA";
            try {
                const data = await response.json();
                if (data && data.message) errorMessage = data.message;
                else if (data && data.error) errorMessage = data.error;
            } catch (e) {
                const txt = await response.text();
                if (txt) errorMessage = txt;
            }
            throw new Error(errorMessage);
        }

        // Obtener el archivo del backend
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);

        document.getElementById('scanning-loader').classList.add('hidden');
        document.getElementById('drop-zone').classList.add('hidden');
        document.getElementById('result-container').classList.remove('hidden');

        // Mostrar y configurar el boton de descarga
        const downloadBtn = document.getElementById('download-report-btn');
        if (downloadBtn) {
            downloadBtn.classList.remove('hidden');
            downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `Reporte_${file.name}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            };
        }

        const tbody = document.getElementById('history-table-body');
        if (tbody) {
            const newRow = `
                        <tr class="hover:bg-white/5 transition animate-pulse" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td class="p-5 flex items-center gap-3"><i class="fa-solid fa-file text-gray-500"></i> <span class="mono-text">${file.name}</span></td>
                            <td class="p-5 text-gray-400">Justo ahora</td>
                            <td class="p-5"><span class="bg-white/10 px-3 py-1 rounded-full text-xs">Exitoso</span></td>
                            <td class="p-5 font-bold text-red-400">82%</td>
                            <td class="p-5"><span class="text-red-400 text-xs font-bold"><i class="fa-solid fa-ban"></i> Detectado</span></td>
                        </tr>
                    `;
            tbody.insertAdjacentHTML('afterbegin', newRow);
        }

    } catch (error) {
        console.error("Upload error:", error);
        document.getElementById('scanning-loader').classList.add('hidden');
        document.getElementById('file-info').classList.remove('hidden');
        alert("Error contactando al servidor backend: " + error.message);
    }
}

function resetScanner() {
    document.getElementById('result-container').classList.add('hidden');
    document.getElementById('drop-zone').classList.remove('hidden');
    document.getElementById('upload-prompt').classList.remove('hidden');

    const downloadBtn = document.getElementById('download-report-btn');
    if (downloadBtn) {
        downloadBtn.classList.add('hidden');
        downloadBtn.onclick = null;
    }

    fileInput.value = '';
}

window.onload = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const user = JSON.parse(userStr);

        // Actualizar Sidebar
        document.getElementById('user-display-name').innerText = user.username || 'Usuario';

        // Actualizar Perfil
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'U')}&background=00e676&color=07040f&bold=true&size=128`;
        const avatarImg = document.getElementById('profile-avatar');
        if (avatarImg) avatarImg.src = avatarUrl;

        const sidebarAvatarImg = document.querySelector('#sidebar img');
        if (sidebarAvatarImg) sidebarAvatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'U')}&background=00e676&color=07040f&bold=true`;

        const profileName = document.getElementById('profile-name');
        if (profileName) profileName.innerText = user.username;

        const profileEmail = document.getElementById('profile-email');
        if (profileEmail) profileEmail.innerText = user.email;

        const profileJoined = document.getElementById('profile-joined');
        if (profileJoined) {
            if (user.created_at) {
                const date = new Date(user.created_at);
                profileJoined.innerText = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            } else {
                profileJoined.innerText = 'Reciente';
            }
        }
    } catch (e) {
        console.error("Error parsing user data");
        window.location.href = 'login.html';
    }

    // Logout Listener
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    }
};