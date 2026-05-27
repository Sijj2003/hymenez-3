// ====================================================================
// 🛡️ NÚCLEO ZERO TRUST - FRONTEND
// ====================================================================
const API_BASE_URL = 'https://sijj2003.pythonanywhere.com';
const AUTH_TOKEN_KEY = 'gymen_auth_token';
const DEVICE_ID_KEY = 'gymen_device_id';

let localDeviceId = localStorage.getItem(DEVICE_ID_KEY);
if (!localDeviceId) {
    localDeviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, localDeviceId);
}

// 🛑 Interceptor Global: Si el backend dice 401, te saca.
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    let [resource, config] = args;
    config = config || {};
    config.headers = config.headers || {};
    
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    
    const response = await originalFetch(resource, config);
    const url = typeof resource === 'string' ? resource : resource.url;
    
    if (response.status === 401 && !url.includes('/api/login') && !url.includes('/api/auth/')) {
        ejecutarPurgaLocal('Tu sesión ha finalizado por seguridad. Vuelve a ingresar.');
    }
    return response;
};

function ejecutarPurgaLocal(mensaje) {
    localStorage.removeItem('userSession');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    alert(mensaje);
    window.location.href = '/apps/start/login.html';
}

function showUIFeedback(message, type = 'success') {
    const box = document.getElementById('message-box');
    if(!box) return;
    box.textContent = message;
    box.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 px-5 py-3 rounded-full text-[10px] font-black tracking-widest uppercase shadow-2xl z-[9999] transition-all duration-400 text-center border backdrop-blur-md w-11/12 max-w-[360px]';
    
    if(type === 'success') { box.classList.add('bg-emerald-950/80', 'text-emerald-400', 'border-emerald-500/30'); } 
    else { box.classList.add('bg-red-950/80', 'text-red-400', 'border-red-500/30'); }
    
    box.style.opacity = '1';
    box.style.transform = 'translate(-50%, 0)';
    setTimeout(() => { box.style.opacity = '0'; box.style.transform = 'translate(-50%, -20px)'; }, 4000);
}

function toggleModal(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) { el.classList.remove('hidden'); setTimeout(() => el.classList.remove('opacity-0'), 10); } 
    else { el.classList.add('opacity-0'); setTimeout(() => el.classList.add('hidden'), 300); }
}

// ====================================================================
// 🚀 INICIALIZACIÓN Y EVENTOS
// ====================================================================
window.onload = function() {
    const isLoginScreen = document.getElementById('login-screen') !== null;
    const isDashboardScreen = document.getElementById('dashboard-screen') !== null;
    const storedSession = localStorage.getItem('userSession');

    // --- PANTALLA LOGIN ---
    if (isLoginScreen) {
        if (storedSession) { window.location.href = '/apps/start/inicio.html'; return; }

        document.getElementById('login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('login-btn');
            btn.disabled = true; btn.textContent = 'AUTENTICANDO...';

            try {
                const res = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: document.getElementById('login-email').value.trim(),
                        password: document.getElementById('login-password').value,
                        deviceId: localDeviceId
                    })
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    localStorage.setItem('userSession', JSON.stringify(data.user));
                    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                    window.location.href = '/apps/start/inicio.html';
                } else {
                    btn.disabled = false; btn.textContent = 'Ingresar al Sistema';
                    if (data.error && data.error.includes('Sesion activa')) {
                        toggleModal('active-session-modal', true);
                        document.getElementById('force-email').value = document.getElementById('login-email').value;
                    } else if (data.requires_activation) {
                        showUIFeedback('Requiere activación OTP.', 'error');
                    } else {
                        showUIFeedback(data.error || 'Credenciales inválidas.', 'error');
                    }
                }
            } catch(err) {
                showUIFeedback('Error de conexión', 'error');
                btn.disabled = false; btn.textContent = 'Ingresar al Sistema';
            }
        });

        // SHIELD PASO 1: SOLICITAR CÓDIGO
        document.getElementById('modal-confirm-btn')?.addEventListener('click', async () => {
            const btn = document.getElementById('modal-confirm-btn');
            btn.disabled = true; btn.textContent = "SOLICITANDO...";

            const res = await fetch(`${API_BASE_URL}/api/auth/request_force_code`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('login-email').value,
                    password: document.getElementById('login-password').value
                })
            });
            const data = await res.json();
            
            if (res.ok && data.success) {
                document.getElementById('modal-options').classList.add('hidden');
                document.getElementById('force-logout-form').classList.remove('hidden');
                showUIFeedback('Código Shield enviado.', 'success');
            } else {
                showUIFeedback(data.error || 'Fallo al solicitar código.', 'error');
                btn.disabled = false; btn.textContent = "Solicitar Código SHIELD";
            }
        });

        // SHIELD PASO 2: VERIFICAR CÓDIGO
        document.getElementById('force-logout-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('force-logout-btn');
            btn.disabled = true; btn.textContent = 'PURGANDO SESIÓN...';

            const res = await fetch(`${API_BASE_URL}/api/auth/verify_force_logout`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('force-email').value,
                    code: document.getElementById('force-shield-code').value,
                    deviceId: localDeviceId
                })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                localStorage.setItem('userSession', JSON.stringify(data.user));
                localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                showUIFeedback('Sesión remota cerrada. Ingresando...', 'success');
                setTimeout(() => window.location.href = '/apps/start/inicio.html', 1000);
            } else {
                showUIFeedback(data.error || 'Código incorrecto.', 'error');
                btn.disabled = false; btn.textContent = 'Expulsar Dispositivo Remoto';
            }
        });

        document.getElementById('modal-cancel-btn')?.addEventListener('click', () => toggleModal('active-session-modal', false));
        document.getElementById('force-logout-cancel')?.addEventListener('click', () => {
            toggleModal('active-session-modal', false);
            setTimeout(() => {
                document.getElementById('modal-options').classList.remove('hidden');
                document.getElementById('force-logout-form').classList.add('hidden');
                document.getElementById('modal-confirm-btn').disabled = false;
                document.getElementById('modal-confirm-btn').textContent = "Solicitar Código SHIELD";
            }, 300);
        });
    }

    // --- PANTALLA DASHBOARD ---
    if (isDashboardScreen) {
        if (!storedSession) { window.location.href = '/apps/start/login.html'; return; }

        // Heartbeat: Llama a la API cada 30 seg. Si el token caduca o la sesión cambia, el interceptor actuará.
        setInterval(() => {
            fetch(`${API_BASE_URL}/api/verify_session`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId: localDeviceId })
            }).catch(() => {});
        }, 30000);

        document.getElementById('logout-button')?.addEventListener('click', async () => {
            document.getElementById('logout-button').disabled = true;
            try {
                await fetch(`${API_BASE_URL}/api/logout`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId: localDeviceId })
                });
            } catch(e) {}
            ejecutarPurgaLocal('Cierre de sesión exitoso.');
        });
    }
};
