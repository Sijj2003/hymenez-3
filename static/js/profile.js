// static/js/profile.js

const API_BASE_URL = 'https://sijj2003.pythonanywhere.com'; 

/**
 * Llama a la API para obtener el perfil del usuario (datos básicos).
 */
async function apiFetchProfileData(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/profile/${userId}`); 
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        return { success: true, profile: data.profile };
    } catch (e) {
        console.error("Error en la conexión de perfil:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Llama a la API para obtener las métricas del usuario.
 */
async function apiFetchMetrics(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/metrics/${userId}`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return await response.json();
    } catch (e) {
        console.error("Error al obtener métricas:", e);
        return { success: false, error: e.message };
    }
}

/**
 * Renderiza la información básica del perfil en el DOM.
 */
function renderProfile(data) {
    document.getElementById('p-fullname').textContent = `${data.name || ''} ${data.last_name || ''}`.trim() || 'ATLETA';
    document.getElementById('p-email').textContent = data.email || '--';
    document.getElementById('p-subscription').textContent = data.subscription_level ? `PLAN ${data.subscription_level}` : 'PLAN BASE';
    document.getElementById('p-dob').textContent = data.dob || '--';
    document.getElementById('p-sex').textContent = data.sex || '--';
    document.getElementById('p-active-since').textContent = data.activo_desde || '--';
}

/**
 * Renderiza las métricas físicas y patologías en el DOM.
 */
function renderMetrics(m) {
    // Rasgos Generales
    document.getElementById('m-peso').textContent = m.peso ? m.peso : '--';
    document.getElementById('m-estatura').textContent = m.estatura ? m.estatura : '--';
    document.getElementById('m-edad').textContent = m.edad ? m.edad : '--';

    // Tren Superior
    document.getElementById('m-cuello').textContent = m.cuello ? `${m.cuello} cm` : '--';
    document.getElementById('m-espalda').textContent = m.espalda ? `${m.espalda} cm` : '--';
    document.getElementById('m-torax').textContent = m.torax ? `${m.torax} cm` : '--';
    document.getElementById('m-abdomen').textContent = m.abdomen ? `${m.abdomen} cm` : '--';
    document.getElementById('m-brazo_der').textContent = m.brazo_derecho || '--';
    document.getElementById('m-brazo_izq').textContent = m.brazo_izquierdo || '--';
    document.getElementById('m-antebrazo_der').textContent = m.antebrazo_derecho || '--';
    document.getElementById('m-antebrazo_izq').textContent = m.antebrazo_izquierdo || '--';

    // Tren Inferior
    document.getElementById('m-cintura').textContent = m.cintura ? `${m.cintura} cm` : '--';
    document.getElementById('m-femur_der').textContent = m.femur_derecho || '--';
    document.getElementById('m-femur_izq').textContent = m.femur_izquierdo || '--';
    document.getElementById('m-tibia_der').textContent = m.tibia_derecha || '--';
    document.getElementById('m-tibia_izq').textContent = m.tibia_izquierda || '--';

    // Patologías
    document.getElementById('m-alergias').textContent = m.alergias || 'Ninguna registrada.';
    document.getElementById('m-enfermedades').textContent = m.enfermedades_cronicas || 'Ninguna registrada.';
    document.getElementById('m-otros').textContent = m.otros || 'Sin observaciones.';
}

/**
 * Función principal: Carga ambos sets de datos simultáneamente.
 */
async function loadProfileData() {
    const storedSession = localStorage.getItem('userSession');
    if (!storedSession) {
        // Redirige al login si no hay sesión
        window.location.href = '/apps/start/login.html';
        return;
    }
    
    try {
        const userSession = JSON.parse(storedSession);
        const userId = userSession._id || userSession.id;

        // Ejecutamos ambas peticiones al mismo tiempo para mayor fluidez
        const [profileRes, metricsRes] = await Promise.all([
            apiFetchProfileData(userId),
            apiFetchMetrics(userId)
        ]);

        if (profileRes.success) {
            renderProfile(profileRes.profile);
        }

        if (metricsRes.success && metricsRes.metrics) {
            renderMetrics(metricsRes.metrics);
        }

        // Transición visual: Oculta el spinner y muestra el contenido progresivamente
        document.getElementById('loading-spinner').classList.add('hidden');
        document.getElementById('profile-content').classList.remove('hidden');

    } catch (error) {
        console.error("Error fatal en la carga de perfil:", error);
        const spinner = document.getElementById('loading-spinner');
        if (spinner) {
            spinner.innerHTML = '<p class="text-red-400 font-bold uppercase tracking-widest">❌ Error al conectar con el servidor.</p>';
        }
    }
}

// Inicia el proceso al cargar la ventana
window.addEventListener('DOMContentLoaded', loadProfileData);
