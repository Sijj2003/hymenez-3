// --- CONFIGURACIÓN DE SEGURIDAD Y SESIÓN ---
const DEVICE_ID_KEY = 'gymen_device_id';
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
// --- LLAMADAS A LA API ---
// =======================================================

async function apiLogin(email, password, deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, deviceId })
        });
        const data = await response.json();

        if (response.status === 403) return { success: false, error: data.error || 'Acceso denegado (403).' };
        if (!response.ok || !data.success) {
            if (data.requires_activation) return { success: false, requires_activation: true, email: data.email, message: data.message };
            return { success: false, error: data.error || 'Credenciales inválidas.' };
        }
        
        CURRENT_USER_SESSION = data.user;
        localStorage.setItem('userSession', JSON.stringify(data.user)); 
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
            await fetch(`${API_BASE_URL}/api/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId, deviceId: localDeviceId })
            });
        }
    } catch (e) {
        console.error("Error al intentar cerrar sesión:", e);
    } finally {
        CURRENT_USER_SESSION = null;
        localStorage.removeItem('userSession'); 
        return { success: true }; 
    }
}

async function apiVerifySession(userId, deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/verify_session`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, deviceId })
        });
        const data = await response.json();
        if (response.status === 403 || !data.success) return { isValid: false, message: data.error || 'Sesión invalidada.' };
        return { isValid: true };
    } catch (e) {
        return { isValid: true }; 
    }
}

async function apiForceLogout(email, password, deviceId, name, lastname, dob, phone, ci) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/force_logout`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, deviceId, name, lastname, dob, phone, ci })
        });
        const data = await response.json();
        if (!response.ok || !data.success) return { success: false, error: data.error || 'Error al forzar cierre.' };
        
        CURRENT_USER_SESSION = data.user;
        localStorage.setItem('userSession', JSON.stringify(data.user)); 
        return { success: true, user: data.user };
    } catch (e) {
        return { success: false, error: 'No se pudo conectar con el servidor.' };
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

// Manejo seguro de Modales (Evita el "Freeze" de pantalla)
function openModalSafe(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
    }, 10);
}

function closeModalSafe(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
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

function applyCIMask(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    let formatted = '';
    let count = 0;
    for (let i = v.length - 1; i >= 0; i--) {
        formatted = v[i] + formatted;
        count++;
        if (count % 3 === 0 && i !== 0) formatted = '.' + formatted;
    }
    e.target.value = formatted;
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
            setTimeout(() => closeModalSafe('block-modal'), 10000); 
        } else if (response.error && (response.error.includes('Sesion activa detectada') || response.error.includes('sesión activa'))) {
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
    
    // 🚩 SI ES ÉXITO, REDIRIGIR AL DASHBOARD
    window.location.href = '/apps/start/inicio.html';
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('reg-submit-btn');
    const originalText = btn ? btn.textContent : 'Crear Cuenta';

    const ciType = document.getElementById('reg-ci-type').value;
    const ciNumber = document.getElementById('reg-ci').value.trim();
    const phonePrefix = document.getElementById('reg-phone-prefix').value;
    const phoneNum = document.getElementById('reg-phone-num').value.trim();

    const data = {
        email: document.getElementById('reg-email').value.trim().toLowerCase(),
        password: document.getElementById('reg-password').value,
        name: document.getElementById('reg-name').value.trim(),
        last_name: document.getElementById('reg-lastname').value.trim(),
        id_number: `${ciType}-${ciNumber}`,        
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

// FUNCIÓN ACTUALIZADA PARA MANEJAR EL NUEVO FORMATO DE TELÉFONO EN FORCE LOGOUT
async function handleForceLogout(e) {
    e.preventDefault();
    const email = document.getElementById('force-email').value;
    const password = document.getElementById('login-password').value; 
    const name = document.getElementById('force-name').value;
    const lastname = document.getElementById('force-lastname').value;
    const dob = document.getElementById('force-dob').value.trim();
    const ci = document.getElementById('force-ci').value.trim(); 
    
    // Captura de teléfono con prefijo
    const phonePrefix = document.getElementById('force-phone-prefix').value;
    const phoneNum = document.getElementById('force-phone-num').value.trim();
    const phone = `${phonePrefix}-${phoneNum}`;

    const btn = document.getElementById('force-logout-btn');
    btn.disabled = true;
    btn.textContent = 'VERIFICANDO DATOS...';
    showForceLogoutMessage(''); 

    const response = await apiForceLogout(email, password, localDeviceId, name, lastname, dob, phone, ci);

    if (response.success) {
        showMessage('Sesión remota cerrada. Ingresando...', 'success');
        closeModalSafe('active-session-modal');
        setTimeout(() => {
            window.location.href = '/apps/start/inicio.html';
        }, 1500); 
    } else {
        showForceLogoutMessage('Error: Los datos no coinciden con tu perfil.', 'error');
        btn.disabled = false;
        btn.textContent = 'CONFIRMAR IDENTIDAD';
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
    sessionCheckerInterval = setInterval(checkSessionValidity, 2000);
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
    if (!CURRENT_USER_SESSION) {
        window.location.href = '/'; 
        return;
    }
    const userId = CURRENT_USER_SESSION._id || CURRENT_USER_SESSION.id;
    const verification = await apiVerifySession(userId, localDeviceId);

    if (!verification.isValid) {
        await apiLogout(); 
        clearInterval(sessionCheckerInterval);
        alert('Tu sesión ha sido cerrada desde otro dispositivo o por un administrador.');
        window.location.href = '/'; 
    }
}

// =======================================================
// --- INICIALIZACIÓN GLOBAL (ONLOAD) ---
// =======================================================

window.onload = function() {
    const isLoginScreen = document.getElementById('login-screen') !== null;
    const isDashboardScreen = document.getElementById('dashboard-screen') !== null;
    const storedSession = localStorage.getItem('userSession');

    // 1. LÓGICA PARA LA PÁGINA DE LOGIN (index.html)
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
                    // Fuerza al renderizado a mostrar el fadeIn
                    requestAnimationFrame(() => {
                        loginScreen.classList.remove('opacity-0');
                        loginScreen.classList.add('opacity-100');
                    });
                }, 1000);
            }
        }, SPLASH_DURATION_MS);

        // Eventos de Formularios
        document.getElementById('login-form')?.addEventListener('submit', handleLogin);
        document.getElementById('force-logout-form')?.addEventListener('submit', handleForceLogout);
        document.getElementById('register-form')?.addEventListener('submit', handleRegister);
        document.getElementById('activation-form')?.addEventListener('submit', handleVerifyActivation);

        // Máscaras de Inputs
        document.getElementById('reg-dob')?.addEventListener('input', applyDateMask);
        document.getElementById('reg-ci')?.addEventListener('input', applyCIMask);
        document.getElementById('reg-phone-num')?.addEventListener('input', applyPhoneMask);
        document.getElementById('force-dob')?.addEventListener('input', applyDateMask);
        document.getElementById('force-ci')?.addEventListener('input', applyCIMask);
        document.getElementById('force-phone-num')?.addEventListener('input', applyPhoneMask); // Listener actualizado

        // Botones de Modales
        document.getElementById('register-request-link')?.addEventListener('click', () => openModalSafe('register-modal'));
        document.getElementById('close-register-modal')?.addEventListener('click', () => closeModalSafe('register-modal'));

        document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
            closeModalSafe('active-session-modal');
            showForceLogoutMessage(''); 
        });
        
        document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
            document.getElementById('modal-options').classList.add('hidden');
            document.getElementById('force-logout-form').classList.remove('hidden');
            document.getElementById('force-email').value = document.getElementById('login-email').value;
        });
        
        document.getElementById('force-logout-cancel')?.addEventListener('click', () => {
            closeModalSafe('active-session-modal');
            setTimeout(() => {
                document.getElementById('modal-options').classList.remove('hidden');
                document.getElementById('force-logout-form').classList.add('hidden');
            }, 300);
        });

        document.getElementById('staff-access-link')?.addEventListener('click', () => openModalSafe('area-selection-modal'));
        document.getElementById('modal-close-btn')?.addEventListener('click', () => closeModalSafe('area-selection-modal'));
        
        document.getElementById('close-activation-modal')?.addEventListener('click', () => closeModalSafe('activation-modal'));
        
        document.getElementById('forgot-password-link')?.addEventListener('click', () => {
            window.open(`https://wa.me/${WHATSAPP_NUMBER.replace(/[^\d+]/g, '')}?text=${encodeURIComponent(WHATSAPP_MESSAGE_RECOVERY)}`, '_blank');
        });
    }

    // 2. LÓGICA PARA LA PÁGINA DEL DASHBOARD (inicio.html)
    if (isDashboardScreen) {
        if (!storedSession) {
            window.location.href = '/';
            return;
        }
        
        CURRENT_USER_SESSION = JSON.parse(storedSession);
        startSessionChecker();

        // Botón de salir
        document.getElementById('logout-button')?.addEventListener('click', async () => {
            const btn = document.getElementById('logout-button');
            btn.disabled = true;
            stopSessionChecker(); 
            await apiLogout(); 
            window.location.href = '/';
        });
    }
};
