 
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
            const icon    = document.getElementById('collapse-icon');
            const texts   = document.querySelectorAll('.sidebar-text');
            
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
            if (type === 'code')  selected.classList.add('type-selected-green');
            if (type === 'text')  selected.classList.add('type-selected-blue');
        }

        const dropZone  = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        dropZone.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) fileInput.click();
        };

        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                document.getElementById('upload-prompt').classList.add('hidden');
                document.getElementById('file-info').classList.remove('hidden');
                document.getElementById('selected-filename').innerText = e.target.files[0].name;
            }
        };

        function processAnalysis(event) {
            event.stopPropagation();
            document.getElementById('file-info').classList.add('hidden');
            document.getElementById('scanning-loader').classList.remove('hidden');

            setTimeout(() => {
                document.getElementById('scanning-loader').classList.add('hidden');
                document.getElementById('drop-zone').classList.add('hidden');
                document.getElementById('result-container').classList.remove('hidden');
                
                const tbody    = document.getElementById('history-table-body');
                const fileName = document.getElementById('selected-filename').innerText;
                const newRow   = `
                    <tr class="hover:bg-white/5 transition animate-pulse" style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td class="p-5 flex items-center gap-3"><i class="fa-solid fa-file text-gray-500"></i> <span class="mono-text">${fileName}</span></td>
                        <td class="p-5 text-gray-400">Justo ahora</td>
                        <td class="p-5"><span class="bg-white/10 px-3 py-1 rounded-full text-xs">Desconocido</span></td>
                        <td class="p-5 font-bold text-red-400">82%</td>
                        <td class="p-5"><span class="text-red-400 text-xs font-bold"><i class="fa-solid fa-ban"></i> Crítico</span></td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('afterbegin', newRow);
            }, 3000);
        }

        function resetScanner() {
            document.getElementById('result-container').classList.add('hidden');
            document.getElementById('drop-zone').classList.remove('hidden');
            document.getElementById('upload-prompt').classList.remove('hidden');
            fileInput.value = '';
        }

        window.onload = () => {
            document.getElementById('user-display-name').innerText = "Analista Demo";
        };