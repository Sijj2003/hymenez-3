// static/js/routines.js

/**
 * Muestra mensajes flotantes de sistema
 */
function showMessage(message, type = 'success') {
    const messagebox = document.getElementById('message-box');
    if (!messagebox) return;

    messagebox.textContent = message;
    messagebox.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-xs font-black tracking-widest uppercase shadow-2xl z-[9999] transition-all duration-500 pointer-events-none text-center'; 
    messagebox.classList.add(type === 'success' ? 'bg-emerald-500' : 'bg-red-500', 'text-white');
    
    // Mostrar
    messagebox.style.opacity = '1';
    messagebox.style.transform = 'translate(-50%, 0)';
    
    // Ocultar
    setTimeout(() => {
        messagebox.style.opacity = '0';
        messagebox.style.transform = 'translate(-50%, -20px)';
    }, 3000);
}

/**
 * Verifica la sesión del usuario y personaliza el saludo.
 */
function initSession() {
    const storedSession = localStorage.getItem('userSession');
    
    if (!storedSession) {
        window.location.href = '/apps/start/login.html';
        return;
    }

    try {
        const user = JSON.parse(storedSession);
        const firstName = user.name ? user.name.split(' ')[0] : 'Atleta';
        
        // Personaliza el saludo del header
        const greetingElement = document.getElementById('user-greeting');
        if (greetingElement) {
            greetingElement.textContent = `Preparado para la acción, ${firstName}`;
        }
    } catch (e) {
        console.error("Error leyendo la sesión:", e);
    }
}

/**
 * Detecta el día actual y resalta la tarjeta correspondiente.
 */
function highlightTodayRoutine() {
    const today = new Date();
    const dayIndex = today.getDay(); // 0 (Domingo) a 6 (Sábado)

    // Mapeo de índices a los 'data-day' del HTML
    const daysMap = {
        1: 'Lunes',
        2: 'Martes',
        3: 'Miércoles',
        4: 'Jueves',
        5: 'Viernes',
        6: 'Sábado',
        0: 'Domingo' // Día de descanso
    };

    const todayDayName = daysMap[dayIndex];

    if (todayDayName) {
        // Busca la tarjeta que coincide con el día de hoy
        const todayCard = document.querySelector(`[data-day="${todayDayName}"]`);
        
        if (todayCard) {
            // 🚨 CORRECCIÓN DEL GHOST BUG: Esperar a que la tarjeta "nazca" (800ms de animación CSS) 
            // antes de inyectar el pulso esmeralda, evitando que colisionen.
            setTimeout(() => {
                todayCard.classList.add('today');
                const badge = todayCard.querySelector('.today-badge');
                if (badge) {
                    badge.classList.remove('hidden');
                }
            }, 800);
        } else if (todayDayName === 'Domingo') {
            showMessage('Hoy es Domingo. ¡Día de recuperación activa!', 'success');
        }
    }
}

// Inicialización al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
    initSession();
    highlightTodayRoutine();
});
