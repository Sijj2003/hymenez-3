// static/js/workout.js

const API_BASE_URL = 'https://sijj2003.pythonanywhere.com'; 
const API_JOURNAL_URL = `${API_BASE_URL}/api/journal/save_session`;
const CONTACT_WHATSAPP = '584148780392'; 
const REDIRECT_URL = 'routines.html'; // Redirección relativa al Hub de Rutinas
const REDIRECT_TIMEOUT_SECONDS = 25; 

let userId = null;
let userFullName = null; 
let routineExercises = []; 
let redirectTimer = null; 

// === 1. DINAMISMO POR URL ===
const urlParams = new URLSearchParams(window.location.search);
const urlDay = urlParams.get('day');
// Valida que el día exista o usa 'Lunes' por defecto. Formatea la primera letra a Mayúscula.
const CURRENT_DAY = urlDay ? urlDay.charAt(0).toUpperCase() + urlDay.slice(1).toLowerCase() : 'Lunes';

// Elementos DOM
const messagebox = document.getElementById('message-box');
const loadingSpinner = document.getElementById('loading-spinner');
const exercisesContainer = document.getElementById('exercises-container');
const noDataMessage = document.getElementById('no-data-message');
const dayTitle = document.getElementById('day-title');
const finishRoutineContainer = document.getElementById('finish-routine-container');
const finishRoutineBtn = document.getElementById('finish-routine-btn');
const finishScreen = document.getElementById('finish-screen');

// Establecer título dinámicamente
document.title = `Protocolo ${CURRENT_DAY} | GYMENEZ`;
if (dayTitle) dayTitle.textContent = `${CURRENT_DAY}`;

// =======================================================
// 🎬 MODAL DE REPRODUCTOR NATIVO (YOUTUBE PARSER) 🎬
// =======================================================
const videoModal = document.getElementById('video-modal');
const videoIframe = document.getElementById('video-iframe');
const videoTitle = document.getElementById('video-title');

function getCleanYouTubeEmbed(url) {
    try {
        // Objeto URL para parsear inteligentemente
        const urlObj = new URL(url);
        let videoId = null;

        // Si es youtube.com
        if (urlObj.hostname.includes('youtube.com')) {
            if (urlObj.pathname === '/watch') {
                videoId = urlObj.searchParams.get('v');
            } else if (urlObj.pathname.startsWith('/embed/')) {
                videoId = urlObj.pathname.split('/')[2];
            } else if (urlObj.pathname.startsWith('/v/')) {
                videoId = urlObj.pathname.split('/')[2];
            } else if (urlObj.pathname.startsWith('/shorts/')) {
                videoId = urlObj.pathname.split('/')[2]; // Soporte para Youtube Shorts
            }
        } 
        // Si es youtu.be (enlaces acortados)
        else if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        }

        // Si logramos extraer el ID, armamos el reproductor premium (sin branding, sin sugerencias)
        if (videoId && videoId.length >= 10) {
            return `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&controls=1&showinfo=0&iv_load_policy=3`;
        }
    } catch (e) {
        console.warn("La URL no tiene un formato estándar, usando Fallback Regex...");
    }

    // Fallback de emergencia por si falla el constructor URL
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
    if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}?autoplay=1&modestbranding=1&rel=0`;
    }

    // Si de plano no es YouTube, retornamos la URL tal cual
    return url;
}

window.openTutorial = async (exerciseName) => {
    try {
        showMessage(`Buscando telemetría...`, 'success');
        const res = await fetch(`${API_BASE_URL}/api/exercises/link_tutorial/${encodeURIComponent(exerciseName)}`);
        const data = await res.json();
        
        if (data.success && data.tutorialLink) {
            const cleanUrl = getCleanYouTubeEmbed(data.tutorialLink);
            
            // Setup Modal
            if (videoTitle) videoTitle.textContent = exerciseName;
            if (videoModal) videoModal.classList.remove('hidden');
            
            // Pequeño delay para el fade-in y el iframe
            setTimeout(() => {
                videoModal.classList.remove('opacity-0');
                if (videoIframe) {
                    videoIframe.src = cleanUrl;
                    // Mostrar el iframe después de un instante para que la animación de carga se vea fluida
                    setTimeout(() => videoIframe.classList.remove('opacity-0'), 800);
                }
            }, 50);

        } else {
            showMessage('Material audiovisual no disponible.', 'error');
        }
    } catch(e) {
        showMessage('Fallo de conexión.', 'error');
    }
};

const closeVideoBtn = document.getElementById('close-video-btn');
if (closeVideoBtn) {
    closeVideoBtn.addEventListener('click', () => {
        if (videoModal) videoModal.classList.add('opacity-0');
        setTimeout(() => {
            if (videoModal) videoModal.classList.add('hidden');
            if (videoIframe) {
                videoIframe.src = ""; // Detener el video cortando el src
                videoIframe.classList.add('opacity-0');
            }
        }, 300);
    });
}

// =======================================================
// 🧩 SISTEMA DE INTERFAZ Y RUTINAS 🧩
// =======================================================

// UI Helpers
function showMessage(message, type = 'success') {
    if (!messagebox) return;
    messagebox.textContent = message;
    messagebox.className = 'fixed top-6 left-1/2 transform -translate-x-1/2 px-4 md:px-6 py-2 md:py-3 rounded-full text-[10px] md:text-xs font-black tracking-widest uppercase shadow-2xl z-[9999] transition-all duration-300 text-center border border-white/10 w-11/12 max-w-[350px]';
    messagebox.classList.add(type === 'success' ? 'bg-emerald-600' : 'bg-red-600', 'text-white');
    messagebox.style.opacity = '1';
    messagebox.style.transform = 'translate(-50%, 0)';
    setTimeout(() => {
        messagebox.style.opacity = '0';
        messagebox.style.transform = 'translate(-50%, -20px)';
    }, 3000);
}

// Lógica de Renderizado de Ejercicios
function renderExercises(exercises) {
    if (!exercisesContainer) return;
    exercisesContainer.innerHTML = ''; 
    if (finishRoutineContainer) finishRoutineContainer.classList.add('hidden'); 
    routineExercises = exercises; 
    
    if (exercises.length === 0) {
        if (noDataMessage) noDataMessage.classList.remove('hidden');
        if (loadingSpinner) loadingSpinner.classList.add('hidden');
        return;
    }

    if (noDataMessage) noDataMessage.classList.add('hidden');
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
    if (finishRoutineContainer) finishRoutineContainer.classList.remove('hidden'); 
    
    exercises.sort((a, b) => (a.order || 0) - (b.order || 0));

    exercises.forEach(exercise => {
        const card = document.createElement('div');
        card.className = 'glass-item-card p-5 md:p-8 rounded-xl md:rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6';
        
        exercise.status = exercise.status || 'pending'; 
        const cardId = exercise.exerciseName.replace(/\s/g, '-');
        
        card.innerHTML = `
            <div class="w-full md:w-auto flex-grow mb-2 md:mb-0"> 
                <h3 class="text-lg md:text-2xl font-black text-white uppercase tracking-tighter mb-2 drop-shadow-md break-words pr-2">${exercise.exerciseName || 'Ejercicio'}</h3>
                <div class="flex flex-wrap gap-3 md:gap-6 text-[9px] md:text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    <p>Sets: <span class="text-[#FFC300] text-xs md:text-sm">${exercise.sets || '-'}</span></p>
                    <p>Reps: <span class="text-[#FFC300] text-xs md:text-sm">${exercise.reps || '-'}</span></p>
                    <p>Peso: <span class="text-[#FFC300] text-xs md:text-sm">${exercise.weight || 'LIBRE'}</span></p>
                </div>
            </div>
            
            <div class="flex items-center space-x-2 md:space-x-4 w-full md:w-auto justify-end border-t border-white/5 pt-4 md:border-t-0 md:pt-0">
                <button onclick="window.openTutorial('${exercise.exerciseName.replace(/'/g, "\\'")}')" class="flex items-center justify-center gap-1 md:gap-2 px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 transition group">
                    <svg class="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:text-[#FFC300] transition" fill="currentColor" viewBox="0 0 20 20"><path d="M4.5 3.5v13L16 10 4.5 3.5z"/></svg>
                    <span class="text-[9px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Play</span>
                </button>

                <div class="flex space-x-1.5 md:space-x-2 bg-black/40 p-1 rounded-lg md:rounded-xl border border-white/5"> 
                    <button id="completed-button-${cardId}" onclick="window.toggleExerciseStatus('${exercise.exerciseName.replace(/'/g, "\\'")}', 'completed')" class="px-3 md:px-5 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-md md:rounded-lg text-gray-400 hover:text-white transition">
                        Check
                    </button>
                    <button id="skip-button-${cardId}" onclick="window.toggleExerciseStatus('${exercise.exerciseName.replace(/'/g, "\\'")}', 'skipped')" class="px-3 md:px-5 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-md md:rounded-lg text-gray-400 hover:text-white transition">
                        Skip
                    </button>
                </div>
            </div>
        `;
        exercisesContainer.appendChild(card);
        // Set initial state colors
        updateCardUI(exercise.exerciseName, exercise.status);
    });
    
    updateFinishButtonState();
}

function updateCardUI(exerciseName, status) {
    const cardId = exerciseName.replace(/\s/g, '-');
    const cBtn = document.getElementById(`completed-button-${cardId}`);
    const sBtn = document.getElementById(`skip-button-${cardId}`);
    
    if (!cBtn || !sBtn) return;
    
    const card = cBtn.closest('.glass-item-card');

    // Resets (con clases responsivas)
    cBtn.className = 'px-3 md:px-5 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-md md:rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition';
    sBtn.className = 'px-3 md:px-5 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-md md:rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition';
    card.classList.remove('is-completed', 'is-skipped');

    if (status === 'completed') {
        cBtn.className = 'px-3 md:px-5 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-md md:rounded-lg bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition';
        card.classList.add('is-completed');
    } else if (status === 'skipped') {
        sBtn.className = 'px-3 md:px-5 py-2 md:py-2.5 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-md md:rounded-lg bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] transition';
        card.classList.add('is-skipped');
    }
}

function updateFinishButtonState() {
    if (!finishRoutineBtn) return;
    const allCompleted = routineExercises.length > 0 && routineExercises.every(e => e.status !== 'pending');
    finishRoutineBtn.disabled = !allCompleted;
    finishRoutineBtn.className = `w-full md:w-2/3 py-4 md:py-5 rounded-xl md:rounded-2xl text-[10px] md:text-sm tracking-[0.2em] font-black transition duration-300 uppercase shadow-2xl ${allCompleted ? 'bg-[#FFC300] hover:bg-yellow-400 text-black shadow-[0_0_30px_rgba(255,195,0,0.3)]' : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/10'}`;
}

window.toggleExerciseStatus = (exerciseName, statusType) => {
    const exercise = routineExercises.find(e => e.exerciseName === exerciseName);
    if (!exercise) return;
    exercise.status = exercise.status === statusType ? 'pending' : statusType;

    updateCardUI(exerciseName, exercise.status);
    updateFinishButtonState();
};

async function loadRoutine() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/routines/day/${userId}/${CURRENT_DAY}`);
        const data = await response.json();
        
        if (data.success && data.routines.length > 0 && data.routines[0].exercises) {
            renderExercises(data.routines[0].exercises);
        } else {
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
            if (noDataMessage) noDataMessage.classList.remove('hidden');
        }
    } catch (e) {
        if (loadingSpinner) {
            loadingSpinner.innerHTML = `<p class="text-red-500 font-bold uppercase tracking-widest text-[10px]">Error Crítico de Datos</p>`;
        }
    }
}

// =======================================================
// 🚀 INICIALIZACIÓN Y EVENTOS GLOBALES 🚀
// =======================================================

window.addEventListener('DOMContentLoaded', () => {
    const session = JSON.parse(localStorage.getItem('userSession'));
    if (!session) {
        window.location.href = '/apps/start/login.html';
        return;
    }
    userId = session._id || session.id;
    userFullName = `${session.name || ''} ${session.last_name || ''}`.trim() || userId;
    loadRoutine();
});

// Eventos de Fin de Rutina y Encuesta
if (finishRoutineBtn) {
    finishRoutineBtn.addEventListener('click', () => {
        const survey = document.getElementById('survey-container');
        const msg = document.getElementById('finish-message');
        
        if (finishScreen) {
            finishScreen.classList.remove('hidden');
            setTimeout(() => finishScreen.classList.remove('opacity-0'), 50);
        }
        
        const audio = document.getElementById('fireworks-audio');
        if(audio) audio.play().catch(()=>{});
        
        const duration = 2500;
        const end = Date.now() + duration;
        (function frame() {
            if (typeof confetti !== 'undefined') {
                confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFC300', '#ffffff', '#333333'] });
                confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFC300', '#ffffff', '#333333'] });
            }
            if (Date.now() < end) requestAnimationFrame(frame);
            else {
                if (msg) msg.style.opacity = 0;
                setTimeout(() => {
                    if (msg) msg.classList.add('hidden');
                    if (survey) {
                        survey.classList.remove('hidden');
                        setTimeout(() => survey.classList.add('survey-visible'), 50);
                    }
                }, 500);
            }
        }());
    });
}

// Control visual del dolor en Encuesta
document.querySelectorAll('input[name="sintio-dolor"]').forEach(r => r.addEventListener('change', (e) => {
    const details = document.getElementById('dolor-details');
    if (details) details.classList.toggle('hidden', e.target.value !== 'si');
}));

document.querySelectorAll('input[name="tipo-dolor"]').forEach(r => r.addEventListener('change', (e) => {
    const otroContainer = document.getElementById('otro-dolor-container');
    if (otroContainer) otroContainer.classList.toggle('hidden', e.target.value !== 'otro');
}));

// Submit Encuesta
const surveyForm = document.getElementById('routine-survey-form');
if (surveyForm) {
    surveyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Llamada futura a saveRoutineJournal
        showModalContacto();
    });
}

const skipLink = document.getElementById('skip-survey-link');
if (skipLink) {
    skipLink.addEventListener('click', (e) => {
        e.preventDefault();
        showModalContacto();
    });
}

function showModalContacto() {
    const survey = document.getElementById('survey-container');
    const contact = document.getElementById('contact-modal');
    
    if (survey) survey.classList.remove('survey-visible');
    setTimeout(() => {
        if (survey) survey.classList.add('hidden');
        if (contact) {
            contact.classList.remove('hidden');
            setTimeout(() => contact.classList.add('survey-visible'), 50);
        }
        startRedirectTimer();
    }, 500);
}

function startRedirectTimer() {
    let count = REDIRECT_TIMEOUT_SECONDS;
    const tc = document.getElementById('timer-count');
    if (tc) tc.textContent = count;
    redirectTimer = setInterval(() => {
        count--;
        if (tc) tc.textContent = count;
        if (count <= 0) handleRedirect();
    }, 1000);
}

function handleRedirect(contactWhatsapp = false) {
    clearInterval(redirectTimer);
    if (contactWhatsapp) {
        window.open(`https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(`Reporte de Sistema: Acabo de terminar mi sesión de ${CURRENT_DAY} y solicito revisión técnica.`)}`, '_blank');
    }
    
    if (finishScreen) finishScreen.classList.add('opacity-0');
    
    setTimeout(() => { window.location.href = REDIRECT_URL; }, 700);
}

const contactYesBtn = document.getElementById('contact-yes-btn');
if (contactYesBtn) contactYesBtn.addEventListener('click', () => handleRedirect(true));

const contactNoBtn = document.getElementById('contact-no-btn');
if (contactNoBtn) contactNoBtn.addEventListener('click', () => handleRedirect(false));
