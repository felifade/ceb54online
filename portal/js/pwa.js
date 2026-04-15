/* ============================================================
   pwa.js – Registro del Service Worker + Prompt de instalación
   Solo opera dentro del portal (/portal/)
   ============================================================ */

(function () {
  'use strict';

  // ── 1. Registrar Service Worker ────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('/portal/sw.js', { scope: '/portal/' })
        .then(function (reg) {
          console.log('[PWA] Service Worker activo. Scope:', reg.scope);
        })
        .catch(function (err) {
          console.warn('[PWA] Error al registrar SW:', err);
        });
    });
  }

  // ── 2. Prompt de instalación (Android / Chrome) ────────────
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', function () {
    hideBanner();
    deferredPrompt = null;
    console.log('[PWA] App instalada correctamente.');
  });

  // ── 3. Crear y mostrar el banner ───────────────────────────
  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return; // ya existe

    var banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML =
      '<div style="display:flex;align-items:center;gap:0.75rem;flex:1;">' +
        '<div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.3rem;">📲</div>' +
        '<div>' +
          '<div style="font-weight:700;font-size:0.9rem;color:#fff;">Instala el Portal en tu celular</div>' +
          '<div style="font-size:0.75rem;color:rgba(255,255,255,0.75);">Acceso rápido desde tu pantalla de inicio</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-shrink:0;">' +
        '<button id="pwa-install-btn" style="background:#fff;color:#3884C0;border:none;padding:0.45rem 1rem;border-radius:20px;font-weight:700;font-size:0.82rem;cursor:pointer;white-space:nowrap;">Instalar</button>' +
        '<button id="pwa-dismiss-btn" style="background:rgba(255,255,255,0.15);color:#fff;border:none;width:30px;height:30px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">✕</button>' +
      '</div>';

    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      zIndex: '9999',
      background: 'linear-gradient(135deg,#3884C0,#7c3aed)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.85rem 1rem',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.2)',
      borderTop: '1px solid rgba(255,255,255,0.1)'
    });

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (result) {
        if (result.outcome === 'accepted') {
          console.log('[PWA] Usuario aceptó la instalación.');
        }
        deferredPrompt = null;
        hideBanner();
      });
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', function () {
      hideBanner();
      // No volver a mostrar en esta sesión
      try { sessionStorage.setItem('pwa_banner_dismissed', '1'); } catch (e) {}
    });
  }

  function hideBanner() {
    var b = document.getElementById('pwa-install-banner');
    if (b) b.remove();
  }

  // No mostrar si ya fue descartado en esta sesión
  try {
    if (sessionStorage.getItem('pwa_banner_dismissed') === '1') {
      window.removeEventListener('beforeinstallprompt', showInstallBanner);
    }
  } catch (e) {}

  // ── 4. Detección iOS: instrucción manual ───────────────────
  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var isInStandaloneMode = ('standalone' in navigator) && navigator.standalone;

  if (isIos && !isInStandaloneMode) {
    try {
      if (sessionStorage.getItem('pwa_ios_shown') === '1') return;
      sessionStorage.setItem('pwa_ios_shown', '1');
    } catch (e) {}

    window.addEventListener('DOMContentLoaded', function () {
      var tip = document.createElement('div');
      tip.id = 'pwa-ios-tip';
      tip.innerHTML =
        '<div style="display:flex;align-items:flex-start;gap:0.75rem;">' +
          '<div style="font-size:1.4rem;flex-shrink:0;">📱</div>' +
          '<div>' +
            '<div style="font-weight:700;font-size:0.9rem;margin-bottom:0.25rem;">Instala el Portal en iPhone</div>' +
            '<div style="font-size:0.8rem;color:#475569;line-height:1.5;">Toca <strong>Compartir</strong> <span style="font-size:1rem;">⬆</span> en Safari y luego <strong>"Agregar a pantalla de inicio"</strong></div>' +
          '</div>' +
          '<button onclick="document.getElementById(\'pwa-ios-tip\').remove()" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:#94a3b8;flex-shrink:0;">✕</button>' +
        '</div>';

      Object.assign(tip.style, {
        position: 'fixed',
        bottom: '0',
        left: '0',
        right: '0',
        zIndex: '9999',
        background: '#fff',
        padding: '1rem',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        borderTop: '1px solid #e2e8f0'
      });

      document.body.appendChild(tip);
    });
  }
})();
