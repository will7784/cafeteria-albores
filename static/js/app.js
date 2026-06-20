// ===== APP STATE =====
let currentTipo = 'ingreso';
let currentSection = 'registro';
let selectedBolsillo = null;
let currentUserIsSuperuser = false;

// ===== UTILS =====
function formatMoney(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(amount);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===== API CALLS =====
async function apiGet(url) {
    const response = await fetch(url);
    return response.json();
}

async function apiPost(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

// ===== NAVIGATION =====
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(section) {
    currentSection = section;
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    
    // Update sections
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.toggle('active', sec.id === section);
    });
    
    // Load section data
    if (section === 'resumen') loadResumenDiario();
    if (section === 'bolsillos') loadBolsillos();
    if (section === 'reportes') loadReporteMensual();
    if (section === 'config') {
        loadCategoriasConfig();
        loadBolsillosConfig();
        if (currentUserIsSuperuser) loadUsuariosConfig();
    }
}

// ===== TIPO SELECTOR =====
function initTipoSelector() {
    document.querySelectorAll('.tipo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTipo = btn.dataset.tipo;
            document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadCategorias();
        });
    });
}

// ===== BOLSILLO SELECTOR =====
function initBolsilloSelector() {
    document.querySelectorAll('.bolsillo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedBolsillo = btn.dataset.bolsillo;
            document.getElementById('bolsillo').value = selectedBolsillo;
            
            document.querySelectorAll('.bolsillo-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}

// ===== CATEGORIAS =====
async function loadCategorias() {
    const categorias = await apiGet(`/api/categorias?tipo=${currentTipo}`);
    const select = document.getElementById('categoria');
    select.innerHTML = '<option value="">Selecciona categoría...</option>';
    
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.nombre;
        option.textContent = cat.nombre;
        select.appendChild(option);
    });
    
    // Reset subcategoria
    document.getElementById('subcategoria-group').style.display = 'none';
}

function initCategoriaHandler() {
    document.getElementById('categoria').addEventListener('change', (e) => {
        const option = e.target.selectedOptions[0];
        // Show subcategoria for all categories
        document.getElementById('subcategoria-group').style.display = 'block';
    });
}

// ===== FORM =====
function initForm() {
    document.getElementById('transaccion-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const bolsillo = document.getElementById('bolsillo').value;
        const montoInput = document.getElementById('monto').value.replace(/[^0-9.]/g, '');
        const monto = parseFloat(montoInput);
        const categoria = document.getElementById('categoria').value;
        const subcategoria = document.getElementById('subcategoria').value;
        const descripcion = document.getElementById('descripcion').value;
        
        if (!bolsillo) {
            showToast('Selecciona un bolsillo (caja)', 'error');
            return;
        }
        
        if (!monto || monto <= 0) {
            showToast('Ingresa un monto válido', 'error');
            return;
        }
        
        if (!categoria) {
            showToast('Selecciona una categoría', 'error');
            return;
        }
        
        const data = {
            tipo: currentTipo,
            bolsillo,
            categoria,
            monto,
            subcategoria: subcategoria || null,
            descripcion: descripcion || null
        };
        
        try {
            await apiPost('/api/transacciones', data);
            showToast(`¡${currentTipo === 'ingreso' ? 'Ingreso' : 'Egreso'} guardado en ${bolsillo}!`);
            
            // Reset form
            document.getElementById('bolsillo').value = '';
            document.getElementById('monto').value = '';
            document.getElementById('categoria').value = '';
            document.getElementById('subcategoria').value = '';
            document.getElementById('descripcion').value = '';
            document.getElementById('subcategoria-group').style.display = 'none';
            
            // Reset bolsillo buttons
            selectedBolsillo = null;
            document.querySelectorAll('.bolsillo-btn').forEach(b => b.classList.remove('active'));
            
            // Reload recent transactions
            loadRecentTransactions();
        } catch (error) {
            showToast('Error al guardar', 'error');
        }
    });
}

// ===== RECENT TRANSACTIONS =====
async function loadRecentTransactions() {
    const transacciones = await apiGet('/api/transacciones/recent');
    const container = document.getElementById('lista-transacciones');
    
    if (transacciones.length === 0) {
        container.innerHTML = '<p class="empty">No hay transacciones hoy</p>';
        return;
    }
    
    container.innerHTML = transacciones.map(t => `
        <div class="transaccion-item ${t.tipo}" data-id="${t.id}">
            <div class="transaccion-info">
                <div class="transaccion-categoria">${t.categoria}</div>
                <div class="transaccion-detalle">
                    ${t.bolsillo ? '👛 ' + t.bolsillo + ' • ' : ''}
                    ${t.subcategoria ? t.subcategoria + ' • ' : ''}
                    ${new Date(t.fecha_hora).toLocaleTimeString('es-CO')}
                </div>
            </div>
            <div class="transaccion-actions">
                <div class="transaccion-monto ${t.tipo}">
                    ${t.tipo === 'ingreso' ? '+' : '-'}${formatMoney(t.monto)}
                </div>
                <div class="action-buttons">
                    <button class="btn-action btn-edit" onclick="editarTransaccion(${t.id})" title="Editar">✏️</button>
                    <button class="btn-action btn-delete" onclick="eliminarTransaccion(${t.id})" title="Eliminar">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ===== RESUMEN DIARIO =====
async function loadResumenDiario() {
    const resumen = await apiGet('/api/resumen-diario');
    
    document.getElementById('total-ingresos').textContent = formatMoney(resumen.total_ingresos);
    document.getElementById('total-egresos').textContent = formatMoney(resumen.total_egresos);
    document.getElementById('balance-hoy').textContent = formatMoney(
        resumen.total_ingresos - resumen.total_egresos
    );
    
    // Ingresos detail
    const ingresosContainer = document.getElementById('detalle-ingresos');
    if (resumen.ingresos.length === 0) {
        ingresosContainer.innerHTML = '<p class="empty">Sin ingresos hoy</p>';
    } else {
        ingresosContainer.innerHTML = resumen.ingresos.map(i => `
            <div class="detalle-item">
                <span class="nombre">
                    <strong>${i.bolsillo}</strong><br>
                    ${i.categoria}${i.subcategoria ? ' - ' + i.subcategoria : ''}
                </span>
                <span class="valor" style="color: #2e7d32">${formatMoney(i.total)}</span>
            </div>
        `).join('');
    }
    
    // Egresos detail
    const egresosContainer = document.getElementById('detalle-egresos');
    if (resumen.egresos.length === 0) {
        egresosContainer.innerHTML = '<p class="empty">Sin egresos hoy</p>';
    } else {
        egresosContainer.innerHTML = resumen.egresos.map(e => `
            <div class="detalle-item">
                <span class="nombre">
                    <strong>${e.bolsillo}</strong><br>
                    ${e.categoria}${e.subcategoria ? ' - ' + e.subcategoria : ''}
                </span>
                <span class="valor" style="color: #c62828">${formatMoney(e.total)}</span>
            </div>
        `).join('');
    }
}

// ===== BOLSILLOS =====
async function loadBolsillos() {
    const resumen = await apiGet('/api/resumen-diario');
    const container = document.getElementById('bolsillos-cards');
    
    const bolsillos = [
        { nombre: 'Efectivo', key: 'Efectivo', icon: '💵', class: 'efectivo' },
        { nombre: 'Nequi', key: 'Nequi', icon: '📱', class: 'nequi' },
        { nombre: 'Bancolombia', key: 'Bancolombia', icon: '🏦', class: 'bancolombia' }
    ];
    
    container.innerHTML = bolsillos.map(b => {
        const saldo = resumen.bolsillos.find(bb => bb.bolsillo === b.key);
        const valor = saldo ? saldo.saldo : 0;
        
        return `
            <div class="bolsillo-card ${b.class}">
                <div class="bolsillo-icon">${b.icon}</div>
                <div class="bolsillo-nombre">${b.nombre}</div>
                <div class="bolsillo-saldo">${formatMoney(valor)}</div>
            </div>
        `;
    }).join('');
}

// ===== REPORTE MENSUAL =====
async function loadReporteMensual() {
    const mesInput = document.getElementById('mes-reporte');
    if (!mesInput.value) {
        mesInput.value = new Date().toISOString().slice(0, 7);
    }
    
    const reporte = await apiGet(`/api/reporte-mensual?mes=${mesInput.value}`);
    
    document.getElementById('reporte-ingresos').textContent = formatMoney(reporte.total_ingresos);
    document.getElementById('reporte-egresos').textContent = formatMoney(reporte.total_egresos);
    document.getElementById('reporte-balance').textContent = formatMoney(
        reporte.total_ingresos - reporte.total_egresos
    );
    
    // Por bolsillo
    const bolsillosContainer = document.getElementById('reporte-bolsillos-mes');
    const ingresosB = reporte.ingresos_bolsillo || [];
    const egresosB = reporte.egresos_bolsillo || [];
    
    bolsillosContainer.innerHTML = '';
    ['Efectivo', 'Nequi', 'Bancolombia'].forEach(bolsillo => {
        const ing = ingresosB.find(i => i.bolsillo === bolsillo);
        const egr = egresosB.find(e => e.bolsillo === bolsillo);
        const totalIng = ing ? ing.total : 0;
        const totalEgr = egr ? egr.total : 0;
        const balance = totalIng - totalEgr;
        
        bolsillosContainer.innerHTML += `
            <div class="detalle-item">
                <span class="nombre"><strong>${bolsillo}</strong></span>
                <span>
                    <span style="color: #2e7d32">+${formatMoney(totalIng)}</span> / 
                    <span style="color: #c62828">-${formatMoney(totalEgr)}</span> = 
                    <span style="font-weight: 700">${formatMoney(balance)}</span>
                </span>
            </div>
        `;
    });
    
    // Gráfico ingresos por día
    renderGraficoDias('grafico-ingresos-dias', reporte.ingresos_diarios, '#2e7d32');
    
    // Gráfico egresos por día
    renderGraficoDias('grafico-egresos-dias', reporte.egresos_diarios, '#c62828');
    
    // Categorías
    document.getElementById('reporte-cat-ingresos').innerHTML = reporte.ingresos_categoria.map(c => `
        <div class="cat-item">
            <span>${c.categoria}</span>
            <span style="color: #2e7d32; font-weight: 700">${formatMoney(c.total)}</span>
        </div>
    `).join('') || '<p class="empty">Sin datos</p>';
    
    document.getElementById('reporte-cat-egresos').innerHTML = reporte.egresos_categoria.map(c => `
        <div class="cat-item">
            <span>${c.categoria}</span>
            <span style="color: #c62828; font-weight: 700">${formatMoney(c.total)}</span>
        </div>
    `).join('') || '<p class="empty">Sin datos</p>';
}

function renderGraficoDias(containerId, datos, color) {
    const container = document.getElementById(containerId);
    
    if (datos.length === 0) {
        container.innerHTML = '<p class="empty">Sin datos</p>';
        return;
    }
    
    const maxValor = Math.max(...datos.map(d => d.total));
    
    container.innerHTML = datos.map(d => {
        const altura = maxValor > 0 ? (d.total / maxValor) * 100 : 0;
        const dia = d.fecha.slice(8, 10);
        return `
            <div class="barra" style="height: ${altura}%; background: ${color}">
                <span class="barra-valor">${(d.total / 1000).toFixed(0)}k</span>
                <span class="barra-label">${dia}</span>
            </div>
        `;
    }).join('');
}

// ===== CONFIGURACIÓN =====
function initConfig() {
    // Tabs de configuración
    document.querySelectorAll('.config-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
    
    // Agregar categoría
    document.getElementById('btn-agregar-cat').addEventListener('click', async () => {
        const tipo = document.getElementById('config-tipo-cat').value;
        const nombre = document.getElementById('nueva-categoria').value.trim();
        const esVueltas = 0;
        
        if (!nombre) {
            showToast('Ingresa un nombre para la categoría', 'error');
            return;
        }
        
        try {
            const response = await apiPost('/api/categorias', { tipo, nombre, es_vueltas: esVueltas });
            if (response.success) {
                showToast('Categoría creada');
                document.getElementById('nueva-categoria').value = '';
                loadCategoriasConfig();
                loadCategorias();
            } else {
                showToast(response.error || 'Error al crear categoría', 'error');
            }
        } catch (error) {
            showToast('Error al crear categoría', 'error');
        }
    });
    
    // Agregar bolsillo
    document.getElementById('btn-agregar-bolsillo').addEventListener('click', async () => {
        const nombre = document.getElementById('nuevo-bolsillo').value.trim();
        const icono = document.getElementById('bolsillo-icono').value;
        
        if (!nombre) {
            showToast('Ingresa un nombre para el bolsillo', 'error');
            return;
        }
        
        try {
            const response = await apiPost('/api/bolsillos', { nombre, icono });
            if (response.success) {
                showToast('Bolsillo creado');
                document.getElementById('nuevo-bolsillo').value = '';
                loadBolsillosConfig();
                loadBolsillos();
            } else {
                showToast(response.error || 'Error al crear bolsillo', 'error');
            }
        } catch (error) {
            showToast('Error al crear bolsillo', 'error');
        }
    });
    
    // Agregar usuario (solo superuser) - usar event delegation para que funcione aunque el elemento esté oculto inicialmente
    document.addEventListener('click', async (e) => {
        if (e.target && e.target.id === 'btn-agregar-user') {
            const username = document.getElementById('nuevo-username').value.trim();
            const password = document.getElementById('nuevo-password').value.trim();
            const isSuperuser = document.getElementById('nuevo-is-superuser').checked ? 1 : 0;
            
            if (!username || !password) {
                showToast('Usuario y contraseña requeridos', 'error');
                return;
            }
            
            if (password.length < 4) {
                showToast('La contraseña debe tener al menos 4 caracteres', 'error');
                return;
            }
            
            try {
                const response = await apiPost('/api/users', { username, password, is_superuser: isSuperuser });
                if (response.success) {
                    showToast('Usuario creado');
                    document.getElementById('nuevo-username').value = '';
                    document.getElementById('nuevo-password').value = '';
                    document.getElementById('nuevo-is-superuser').checked = false;
                    loadUsuariosConfig();
                } else {
                    showToast(response.error || 'Error al crear usuario', 'error');
                }
            } catch (error) {
                showToast('Error al crear usuario', 'error');
            }
        }
    });
}

async function loadUsuariosConfig() {
    const usuarios = await apiGet('/api/users');
    const container = document.getElementById('lista-usuarios');
    
    container.innerHTML = usuarios.map(u => `
        <div class="config-item">
            <div class="item-info">
                <span class="item-nombre">${u.username}</span>
                ${u.is_superuser ? '<span class="item-tipo">superuser</span>' : ''}
            </div>
            ${u.activo ? `<button class="btn-eliminar" onclick="eliminarUsuario(${u.id})">🗑️</button>` : '<span style="color:#999">Inactivo</span>'}
        </div>
    `).join('') || '<p class="empty">Sin usuarios</p>';
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    
    try {
        const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Usuario eliminado');
            loadUsuariosConfig();
        } else {
            showToast(data.error || 'No se pudo eliminar', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function loadCategoriasConfig() {
    const categorias = await apiGet('/api/categorias/all');
    
    const ingresos = categorias.filter(c => c.tipo === 'ingreso');
    const egresos = categorias.filter(c => c.tipo === 'egreso');
    
    document.getElementById('lista-cat-ingresos').innerHTML = ingresos.map(c => `
        <div class="config-item">
            <div class="item-info">
                <span class="item-nombre">${c.nombre}</span>
            </div>
            <button class="btn-eliminar" onclick="eliminarCategoria(${c.id})">🗑️</button>
        </div>
    `).join('') || '<p class="empty">Sin categorías</p>';
    
    document.getElementById('lista-cat-egresos').innerHTML = egresos.map(c => `
        <div class="config-item">
            <div class="item-info">
                <span class="item-nombre">${c.nombre}</span>
            </div>
            <button class="btn-eliminar" onclick="eliminarCategoria(${c.id})">🗑️</button>
        </div>
    `).join('') || '<p class="empty">Sin categorías</p>';
}

async function loadBolsillosConfig() {
    const bolsillos = await apiGet('/api/bolsillos');
    
    document.getElementById('lista-bolsillos').innerHTML = bolsillos.map(b => `
        <div class="config-item">
            <div class="item-info">
                <span class="item-icon">${b.icono}</span>
                <span class="item-nombre">${b.nombre}</span>
            </div>
            <button class="btn-eliminar" onclick="eliminarBolsillo(${b.id})">🗑️</button>
        </div>
    `).join('') || '<p class="empty">Sin bolsillos</p>';
}

async function eliminarCategoria(id) {
    if (!confirm('¿Eliminar esta categoría?')) return;
    
    try {
        const response = await fetch(`/api/categorias/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Categoría eliminada');
            loadCategoriasConfig();
            loadCategorias();
        } else {
            showToast(data.error || 'No se pudo eliminar', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function eliminarBolsillo(id) {
    if (!confirm('¿Eliminar este bolsillo?')) return;
    
    try {
        const response = await fetch(`/api/bolsillos/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Bolsillo eliminado');
            loadBolsillosConfig();
            loadBolsillos();
        } else {
            showToast(data.error || 'No se pudo eliminar', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
    // Cambiar contraseña
    const btnCambiarPassword = document.getElementById('btn-cambiar-password');
    if (btnCambiarPassword) {
        btnCambiarPassword.addEventListener('click', async () => {
            const passwordActual = document.getElementById('password-actual').value;
            const passwordNueva = document.getElementById('password-nueva').value;
            const passwordConfirmar = document.getElementById('password-confirmar').value;
            
            if (!passwordActual || !passwordNueva || !passwordConfirmar) {
                showToast('Todos los campos son requeridos', 'error');
                return;
            }
            
            if (passwordNueva !== passwordConfirmar) {
                showToast('Las contraseñas no coinciden', 'error');
                return;
            }
            
            if (passwordNueva.length < 4) {
                showToast('La nueva contraseña debe tener al menos 4 caracteres', 'error');
                return;
            }
            
            try {
                const response = await apiPost('/api/users/cambiar-password', {
                    password_actual: passwordActual,
                    password_nueva: passwordNueva
                });
                
                if (response.success) {
                    showToast('Contraseña cambiada exitosamente');
                    document.getElementById('password-actual').value = '';
                    document.getElementById('password-nueva').value = '';
                    document.getElementById('password-confirmar').value = '';
                } else {
                    showToast(response.error || 'Error al cambiar contraseña', 'error');
                }
            } catch (error) {
                showToast('Error al cambiar contraseña', 'error');
            }
        });
    }
}

// ===== EDITAR / ELIMINAR TRANSACCIONES =====
async function eliminarTransaccion(id) {
    if (!confirm('¿Eliminar esta transacción?')) return;
    
    try {
        const response = await fetch(`/api/transacciones/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showToast('Transacción eliminada');
            loadRecentTransactions();
            loadResumenDiario();
            loadBolsillos();
        } else {
            showToast(data.error || 'No se pudo eliminar', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function editarTransaccion(id) {
    const nuevoMonto = prompt('Ingresa el nuevo monto:');
    if (!nuevoMonto || isNaN(parseFloat(nuevoMonto))) {
        showToast('Monto inválido', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/transacciones/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monto: parseFloat(nuevoMonto) })
        });
        const data = await response.json();
        
        if (data.success) {
            showToast('Transacción actualizada');
            loadRecentTransactions();
            loadResumenDiario();
            loadBolsillos();
        } else {
            showToast(data.error || 'No se pudo actualizar', 'error');
        }
    } catch (error) {
        showToast('Error al actualizar', 'error');
    }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth first
    const auth = await apiGet('/api/auth/check');
    if (!auth.authenticated) {
        window.location.href = '/login';
        return;
    }
    
    // Show username
    document.getElementById('user-name').textContent = '👤 ' + auth.username;
    
    // Store superuser status
    currentUserIsSuperuser = auth.is_superuser;
    
    // Show users tab only for superuser
    if (auth.is_superuser) {
        document.getElementById('tab-btn-usuarios').style.display = 'block';
        document.getElementById('usuarios-superuser').style.display = 'block';
    } else {
        document.getElementById('usuarios-no-superuser').style.display = 'block';
    }
    
    // Set current date in header
    document.getElementById('fecha-actual').textContent = formatDate(new Date());
    
    // Initialize month input
    document.getElementById('mes-reporte').value = new Date().toISOString().slice(0, 7);
    document.getElementById('mes-reporte').addEventListener('change', loadReporteMensual);
    
    // Init all modules
    initNavigation();
    initTipoSelector();
    initBolsilloSelector();
    initCategoriaHandler();
    initForm();
    initConfig();
    
    // Load initial data
    loadCategorias();
    loadRecentTransactions();
});
