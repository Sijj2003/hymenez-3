// --- CONFIGURACIÓN DE SEGURIDAD Y SESIÓN ---
const DEVICE_ID_KEY = 'gymen_device_id';
const AUTH_TOKEN_KEY = 'gymen_auth_token'; // 🔐 Respaldo criptográfico JWT para el ecosistema

let localDeviceId = localStorage.getItem(DEVICE_ID_KEY);

if (!localDeviceId) {
    localDeviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, localDeviceId);
}

const API_BASE_URL = 'https://sijj2003.pythonanywhere.com'; 
const SPLASH_DURATION_MS = 3000; 

let CURRENT_USER_SESSION = null; 
let sessionCheckerInterval = null; 
let isFirstCheckIgnored = false; 

const WHATSAPP_NUMBER = '+584148780392';
const WHATSAPP_MESSAGE_RECOVERY = 'Hola quisiera solicitar la recuperacion de credenciales';

// =======================================================
// --- INTERCEPTOR GLOBAL DE PETICIONES (ZERO TRUST) ---
// =======================================================
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    if (typeof args[1] === 'undefined') args[1] = {};
    if (typeof args[1].credentials === 'undefined') args[1].credentials = 'include';
    
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
        if (typeof args[1].headers === 'undefined') args[1].headers = {};
        if (typeof args[1].headers['Authorization'] === 'undefined') {
            args[1].headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    const response = await originalFetch.apply(this, args);
    
    const requestUrl = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
    const isAuthRoute = requestUrl.includes('/api/login') || 
                        requestUrl.includes('/api/register') || 
                        requestUrl.includes('/api/auth/request_force_code') ||
                        requestUrl.includes('/api/auth/verify_force_logout');
    
    if (response.status === 401 && !isAuthRoute) {
        console.warn("🚨 Token expirado detectado por interceptor. Expulsando...");
        forceGlobalLogout();
    }
    
    return response;
};

function forceGlobalLogout() {
    CURRENT_USER_SESSION = null;
    localStorage.removeItem('userSession');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem('gymen_session_exp');
    stopSessionChecker();
    alert('Tu sesión ha expirado o ha sido cerrada desde otra terminal por seguridad.');
    window.location.href = '/apps/start/login.html';
}

// =======================================================
// --- LLAMADAS A LA API ---
// =======================================================

async function apiLogin(email, password, deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, deviceId })
        });

        if (response.status === 429) {
            return { success: false, error: 'Múltiples intentos detectados. Espera 60 segundos.' };
        }

        const data = await response.json();

        if (response.status === 403) return { success: false, error: data.error || 'Acceso denegado (403).' };
        if (!response.ok || !data.success) {
            if (data.requires_activation) return { success: false, requires_activation: true, email: data.email, message: data.message };
            return { success: false, error: data.error || 'Credenciales inválidas.' };
        }
        
        CURRENT_USER_SESSION = data.user;
        localStorage.setItem('userSession', JSON.stringify(data.user)); 
        if (data.token) {
            localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        }
        
        const tiempoExpiracion = Date.now() + (480 * 60 * 1000); // 8 Horas
        localStorage.setItem('gymen_session_exp', tiempoExpiracion);
        
        return { success: true, user: data.user };
    } catch (e) {
        return { success: false, error: 'Error de conexión con el servidor.' };
    }
}

async function apiLogout() {
    try {
        let userId = (CURRENT_USER_SESSION && (CURRENT_USER_SESSION._id || CURRENT_USER_SESSION.id));
        if (!userId) {
            const storedSession = localStorage.getItem('userSession');
            if (storedSession) userId = JSON.parse(storedSession).id || JSON.parse(storedSession)._id;
        }
        if (userId) {
            const token = localStorage.getItem(AUTH_TOKEN_KEY);
            await fetch(`${API_BASE_URL}/api/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ userId: userId, deviceId: localDeviceId })
            });
        }
    } catch (e) {
        console.error("Error al intentar cerrar sesión:", e);
    } finally {
        CURRENT_USER_SESSION = null;
        localStorage.removeItem('userSession'); 
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('gymen_session_exp');
        return { success: true }; 
    }
}

async function apiVerifySession(userId, deviceId) {
    try {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const response = await fetch(`${API_BASE_URL}/api/verify_session`, { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ userId, deviceId })
        });
        const data = await response.json();
        if (response.status === 403 || !data.success) return { isValid: false, message: data.error || 'Sesión invalidada.' };
        return { isValid: true };
    } catch (e) {
        return { isValid: true }; 
    }
}

// =======================================================
// --- UTILIDADES DE INTERFAZ Y MODALES ---
// =======================================================

function showMessage(message, type = 'success') {
    const messagebox = document.getElementById('message-box');
    if(!messagebox) return;
    messagebox.textContent = message;
    messagebox.className = ''; 
    messagebox.classList.add('transition-none', 'message-' + type, 'bg-' + (type === 'success' ? 'green' : 'red') + '-600');
    messagebox.style.opacity = '1';
    messagebox.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
        messagebox.removeAttribute('style'); 
        messagebox.style.opacity = '0';
        messagebox.style.transform = 'translateX(-50%) translateY(-20px)';
    }, 3000);
}

function showForceLogoutMessage(message, type = 'error') {
    const msgBox = document.getElementById('force-logout-message');
    if(!msgBox) return;
    if (message) {
        msgBox.textContent = message;
        msgBox.className = `p-3 mb-4 rounded-lg font-bold text-center text-xs tracking-widest uppercase ${type === 'error' ? 'bg-red-900/30 border border-red-500/50 text-red-400' : 'bg-green-900/30 border border-green-500/50 text-green-400'}`;
        msgBox.classList.remove('hidden');
    } else {
        msgBox.classList.add('hidden'); 
    }
}

function openModalSafe(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
    }, 10);
}

// =======================================================
// --- MÁSCARAS INTELIGENTES ---
// =======================================================

function applyDateMask(e) {
    if (e.inputType === 'deleteContentBackward') return; 
    let v = e.target.value.replace(/\D/g, ''); 
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length >= 5) e.target.value = `${v.substring(0, 2)}/${v.substring(2, 4)}/${v.substring(4)}`;
    else if (v.length >= 3) e.target.value = `${v.substring(0, 2)}/${v.substring(2)}`;
    else e.target.value = v;
}

function applyPhoneMask(e) {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 7);
}

// =======================================================
// --- CONTROLADORES DE EVENTOS (LOGIN, REGISTRO, ETC) ---
// =======================================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    btn.disabled = true;
    btn.textContent = 'VERIFICANDO...';

    const response = await apiLogin(email, password, localDeviceId);
    
    if (!response.success) {
        btn.disabled = false;
        btn.textContent = 'INGRESAR AL PORTAL';

        if (response.requires_activation) {
            document.getElementById('activation-email').value = response.email || email;
            openModalSafe('activation-modal');
            showMessage('Revisa tu correo para el código de seguridad.', 'success');
            return;
        }
        
        if (response.error && response.error.includes('bloqueada')) {
            openModalSafe('block-modal');
            showMessage('Acceso Restringido.', 'error');
        } else if (response.error && (response.error.includes('Sesion activa detectada') || response.error.includes('sesión activa') || response.error.includes('Sesion activa'))) {
            openModalSafe('active-session-modal');
            showMessage('Sesión en uso detectada.', 'error');
            document.getElementById('force-logout-form').classList.add('hidden');
            document.getElementById('modal-options').classList.remove('hidden');
            showForceLogoutMessage(''); 
        } else {
            showMessage(response.error, 'error');
        }
        return;
    } 
    
    window.location.href = '/apps/start/inicio.html';
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('reg-submit-btn');
    const originalText = btn ? btn.textContent : 'Crear Cuenta';

    const phonePrefix = document.getElementById('reg-phone-prefix').value;
    const phoneNum = document.getElementById('reg-phone-num').value.trim();

    const data = {
        email: document.getElementById('reg-email').value.trim().toLowerCase(),
        password: document.getElementById('reg-password').value,
        name: document.getElementById('reg-name').value.trim(),
        last_name: document.getElementById('reg-lastname').value.trim(),
        phone_number: `${phonePrefix}-${phoneNum}`,  
        dob: document.getElementById('reg-dob').value.trim(), 
        sex: document.getElementById('reg-sex').value
    };

    if (btn) { btn.disabled = true; btn.textContent = 'PROCESANDO...'; }

    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.status === 429) {
            showMessage('Límite de registros alcanzado. Intenta más tarde.', 'error');
            return; 
        }

        const res = await response.json();
        if (response.ok && res.success) {
            showMessage('¡Perfil creado! Revisa tu correo e inicia sesión.', 'success');
            closeModalSafe('register-modal');
            e.target.reset(); 
        } else {
            showMessage(res.error || 'No se pudo completar el registro.', 'error');
        }
    } catch (err) {
        showMessage('Error de red al intentar registrar.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = originalText; }
    }
}

async function handleVerifyActivation(e) {
    e.preventDefault();
    const email = document.getElementById('activation-email').value;
    const code = document.getElementById('activation-code').value;
    const btn = document.getElementById('verify-btn');

    btn.disabled = true;
    btn.textContent = 'VERIFICANDO...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/verify-activation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            showMessage('¡Cuenta activada! Ingresando al sistema...', 'success');
            closeModalSafe('activation-modal');
            document.getElementById('login-btn').click(); 
        } else {
            showMessage(data.error || 'Código inválido o expirado.', 'error');
        }
    } catch (err) {
        showMessage('Error al verificar el código.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'AUTENTICAR CÓDIGO';
    }
}

// =======================================================
// --- HEARTBEAT Y VERIFICACIÓN CONTINUA ---
// =======================================================

function startSessionChecker() {
    if (sessionCheckerInterval) clearInterval(sessionCheckerInterval);
    isFirstCheckIgnored = true; 
    checkSessionValidity(); 
    sessionCheckerInterval = setInterval(checkSessionValidity, 15000); // 15s para balancear rendimiento/batería
}

function stopSessionChecker() {
    if (sessionCheckerInterval) {
        clearInterval(sessionCheckerInterval);
        sessionCheckerInterval = null;
    }
}

async function checkSessionValidity() {
    if (isFirstCheckIgnored) {
        isFirstCheckIgnored = false; 
        return; 
    }
    
    const exp = localStorage.getItem('gymen_session_exp');
    if (exp && Date.now() >= parseInt(exp)) {
        forceGlobalLogout();
        return;
    }

    if (!CURRENT_USER_SESSION) {
        window.location.href = '/apps/start/login.html'; 
        return;
    }
    const userId = CURRENT_USER_SESSION._id || CURRENT_USER_SESSION.id;
    const verification = await apiVerifySession(userId, localDeviceId);

    if (!verification.isValid) {
        await apiLogout(); 
        clearInterval(sessionCheckerInterval);
        alert('Tu sesión ha sido cerrada desde otro dispositivo o por un administrador.');
        window.location.href = '/apps/start/login.html'; 
    }
}

function closeModalSafe(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

// =======================================================
// --- INICIALIZACIÓN GLOBAL (ONLOAD) ---
// =======================================================

window.onload = function() {
    const isLoginScreen = document.getElementById('login-screen') !== null;
    const isDashboardScreen = document.getElementById('dashboard-screen') !== null;
    const storedSession = localStorage.getItem('userSession');

    if (storedSession) {
        CURRENT_USER_SESSION = JSON.parse(storedSession);
    }

    // 1. LÓGICA PARA LA PÁGINA DE LOGIN
    if (isLoginScreen) {
        if (storedSession) {
            window.location.href = '/apps/start/inicio.html';
            return;
        }

        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if(splash) {
                splash.style.transition = 'opacity 1s ease-out';
                splash.style.opacity = '0';
                setTimeout(() => {
                    splash.style.display = 'none';
                    const loginScreen = document.getElementById('login-screen');
                    loginScreen.classList.remove('hidden'); 
                    requestAnimationFrame(() => {
                        loginScreen.classList.remove('opacity-0');
                        loginScreen.classList.add('opacity-100');
                    });
                }, 1000);
            }
        }, SPLASH_DURATION_MS);

        // Eventos de Formularios
        document.getElementById('login-form')?.addEventListener('submit', handleLogin);
        document.getElementById('register-form')?.addEventListener('submit', handleRegister);
        document.getElementById('activation-form')?.addEventListener('submit', handleVerifyActivation);

        // Máscaras de Inputs
        document.getElementById('reg-dob')?.addEventListener('input', applyDateMask);
        document.getElementById('reg-phone-num')?.addEventListener('input', applyPhoneMask);

        // Botones de Modales
        document.getElementById('register-request-link')?.addEventListener('click', () => openModalSafe('register-modal'));
        document.getElementById('close-register-modal')?.addEventListener('click', () => closeModalSafe('register-modal'));

        document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
            closeModalSafe('active-session-modal');
            showForceLogoutMessage(''); 
        });
        
        // 🔥 SHIELD PASO 1: SOLICITAR CÓDIGO OTP AL NÚCLEO
        document.getElementById('modal-confirm-btn')?.addEventListener('click', async () => {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = document.getElementById('modal-confirm-btn');

            btn.disabled = true;
            btn.textContent = "GENERANDO PROTOCOLO SHIELD...";

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/request_force_code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    document.getElementById('modal-options').classList.add('hidden');
                    document.getElementById('force-logout-form').classList.remove('hidden');
                    document.getElementById('force-email').value = email;
                    showForceLogoutMessage('Código enviado con éxito. Revisa tu buzón.', 'success');
                } else {
                    alert(data.error || 'No se pudo generar el token de seguridad.');
                    btn.disabled = false;
                    btn.textContent = "Solicitar Código SHIELD";
                }
            } catch(err) {
                alert('Error de conexión en el perímetro de seguridad.');
                btn.disabled = false;
                btn.textContent = "Solicitar Código SHIELD";
            }
        });
        
        // 🔥 SHIELD PASO 2: COMPROBAR OTP Y ACCIONAR EYECCIÓN ATÓMICA
        document.getElementById('force-logout-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('force-email').value;
            const code = document.getElementById('force-shield-code').value;
            const btn = document.getElementById('force-logout-btn');

            btn.disabled = true;
            btn.textContent = 'AUTENTICANDO CÓDIGO...';
            showForceLogoutMessage('');

            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/verify_force_logout`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code, deviceId: localDeviceId })
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    localStorage.setItem('userSession', JSON.stringify(data.user)); 
                    if (data.token) {
                        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                    }
                    
                    const tiempoExpiracion = Date.now() + (480 * 60 * 1000);
                    localStorage.setItem('gymen_session_exp', tiempoExpiracion);

                    showMessage('Sesión remota purgada. Ingresando...', 'success');
                    closeModalSafe('active-session-modal');
                    setTimeout(() => {
                        window.location.href = '/apps/start/inicio.html';
                    }, 1200);
                } else {
                    showForceLogoutMessage(data.error || 'Código incorrecto o vencido.', 'error');
                    btn.disabled = false;
                    btn.textContent = 'Expulsar Dispositivo Remoto';
                }
            } catch(err) {
                showForceLogoutMessage('Error de red al procesar la desconexión.', 'error');
                btn.disabled = false;
                btn.textContent = 'Expulsar Dispositivo Remoto';
            }
        });
        
        document.getElementById('force-logout-cancel')?.addEventListener('click', () => {
            closeModalSafe('active-session-modal');
            setTimeout(() => {
                document.getElementById('modal-options').classList.remove('hidden');
                document.getElementById('force-logout-form').classList.add('hidden');
                document.getElementById('force-shield-code').value = '';
                const btnConfirm = document.getElementById('modal-confirm-btn');
                if (btnConfirm) { btnConfirm.disabled = false; btnConfirm.textContent = "Solicitar Código SHIELD"; }
            }, 300);
        });

        document.getElementById('staff-access-link')?.addEventListener('click', () => openModalSafe('area-selection-modal'));
        document.getElementById('modal-close-btn')?.addEventListener('click', () => closeModalSafe('area-selection-modal'));
        document.getElementById('close-activation-modal')?.addEventListener('click', () => closeModalSafe('activation-modal'));
        
        document.getElementById('forgot-password-link')?.addEventListener('click', () => {
            window.open(`https://wa.me/${WHATSAPP_NUMBER.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(WHATSAPP_MESSAGE_RECOVERY)}`, '_blank');
        });
    }

    // 2. LÓGICA PARA LA PÁGINA DEL DASHBOARD
    if (isDashboardScreen) {
        if (!storedSession) {
            window.location.href = '/apps/start/login.html';
            return;
        }
        
        startSessionChecker();

        document.getElementById('logout-button')?.addEventListener('click', async () => {
            const btn = document.getElementById('logout-button');
            btn.disabled = true;
            stopSessionChecker(); 
            await apiLogout(); 
            window.location.href = '/apps/start/login.html';
        });
    }
};
