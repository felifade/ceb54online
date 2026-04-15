// ============================================================
//  Portal Docente CEB 5/4 – app.js
// ============================================================

// ── PIN ──────────────────────────────────────────────────────
// Cambia este valor para personalizar tu PIN de acceso
const PORTAL_PIN = '5401';

const SESSION_KEY = 'pd_session';
const DISMISS_KEY = 'pd_install_dismissed';

// ── Estado PIN ───────────────────────────────────────────────
let pinBuffer = '';

const overlay    = document.getElementById('pin-overlay');
const pinBox     = document.getElementById('pin-box');
const pinError   = document.getElementById('pin-error');
const portalMain = document.getElementById('portal-main');

function updateDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.classList.toggle('filled', i < pinBuffer.length);
  }
}

function onPinKey(val) {
  if (val === 'del') {
    pinBuffer = pinBuffer.slice(0, -1);
    updateDots();
    pinError.textContent = '';
    return;
  }
  if (pinBuffer.length >= 4) return;

  pinBuffer += val;
  updateDots();

  if (pinBuffer.length === 4) {
    validatePin();
  }
}

function validatePin() {
  if (pinBuffer === PORTAL_PIN) {
    sessionStorage.setItem(SESSION_KEY, '1');
    overlay.style.transition = 'opacity 0.3s ease';
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
      portalMain.style.display = 'block';
    }, 300);
  } else {
    pinBox.classList.add('shake');
    pinError.textContent = 'PIN incorrecto. Inténtalo de nuevo.';
    pinBuffer = '';
    updateDots();
    setTimeout(() => pinBox.classList.remove('shake'), 400);
  }
}

// Click en teclas del numpad
document.querySelectorAll('.pin-key').forEach(btn => {
  btn.addEventListener('click', () => onPinKey(btn.dataset.val));
});

// Teclado físico
document.addEventListener('keydown', e => {
  if (overlay.style.display === 'none') return;
  if (e.key >= '0' && e.key <= '9') onPinKey(e.key);
  if (e.key === 'Backspace') onPinKey('del');
});

// Verificar sesión activa
if (sessionStorage.getItem(SESSION_KEY) === '1') {
  overlay.style.display = 'none';
  portalMain.style.display = 'block';
}

// ── CERRAR SESIÓN ────────────────────────────────────────────
document.getElementById('btn-lock').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  pinBuffer = '';
  updateDots();
  pinError.textContent = '';
  overlay.style.opacity = '1';
  overlay.style.display = 'flex';
  portalMain.style.display = 'none';
});

// ── PWA: SERVICE WORKER ──────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/portal-docente/sw.js', { scope: '/portal-docente/' })
      .then(() => console.log('[Portal Docente] PWA activa ✓'))
      .catch(err => console.warn('[Portal Docente] Error SW:', err));
  });
}

// ── PWA: BOTÓN INSTALAR ──────────────────────────────────────
let installPrompt = null;
const installBanner = document.getElementById('install-banner');
const btnInstall    = document.getElementById('btn-install');
const btnDismiss    = document.getElementById('btn-dismiss');

// No mostrar si ya fue descartado
const alreadyDismissed = localStorage.getItem(DISMISS_KEY);

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;

  if (!alreadyDismissed) {
    installBanner.classList.add('visible');
  }
});

btnInstall.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  console.log('[Portal Docente] Install outcome:', outcome);
  installBanner.classList.remove('visible');
  installPrompt = null;
});

btnDismiss.addEventListener('click', () => {
  installBanner.classList.remove('visible');
  localStorage.setItem(DISMISS_KEY, '1');
});

// Ocultar banner si la app ya está instalada
window.addEventListener('appinstalled', () => {
  installBanner.classList.remove('visible');
  installPrompt = null;
  console.log('[Portal Docente] App instalada ✓');
});
