/**
 * _shared/utils.js — Utilidades comunes del sistema CEB 5/4
 * Carga: <script src="../_shared/utils.js"></script>
 * Expone: window.CEB.normalizeText | showToast | clearSession
 */
(function (global) {
  'use strict';

  // ── Normalización de texto ────────────────────────────────────
  // Elimina acentos y convierte a minúsculas (idéntica a la de los GAS)
  function normalizeText(val) {
    if (!val) return '';
    return String(val)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  // ── Toast de notificaciones ──────────────────────────────────
  // type: 'success' | 'error' | 'warning' | 'info'
  // duration en ms (default 3500)
  function showToast(message, type, duration) {
    type     = type     || 'info';
    duration = duration || 3500;

    var container = document.getElementById('ceb-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'ceb-toast-container';
      container.style.cssText =
        'position:fixed;bottom:2rem;right:2rem;z-index:99999;' +
        'display:flex;flex-direction:column-reverse;gap:0.5rem;pointer-events:none;';
      document.body.appendChild(container);
    }

    var palette = {
      success: { bg: '#059669', ico: '✓' },
      error:   { bg: '#dc2626', ico: '✕' },
      warning: { bg: '#d97706', ico: '⚠' },
      info:    { bg: '#3b82f6', ico: 'ℹ' }
    };
    var p = palette[type] || palette.info;

    var toast = document.createElement('div');
    toast.style.cssText =
      'background:' + p.bg + ';color:#fff;' +
      'padding:0.75rem 1.1rem;border-radius:12px;' +
      'font-size:0.875rem;font-weight:600;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.22);' +
      'display:flex;align-items:center;gap:0.55rem;' +
      'max-width:340px;min-width:180px;' +
      'font-family:Inter,-apple-system,sans-serif;' +
      'pointer-events:auto;' +
      'transform:translateX(24px);opacity:0;' +
      'transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),opacity 0.25s;';
    toast.innerHTML =
      '<span style="font-size:1rem;flex-shrink:0;">' + p.ico + '</span>' +
      '<span>' + message + '</span>';
    container.appendChild(toast);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity   = '1';
      });
    });

    setTimeout(function () {
      toast.style.transform = 'translateX(24px)';
      toast.style.opacity   = '0';
      setTimeout(function () { toast.remove(); }, 320);
    }, duration);
  }

  // ── Limpieza de sesión ────────────────────────────────────────
  // Centraliza la eliminación de todas las claves de sessionStorage
  function clearSession() {
    ['tutorias_auth', 'user_name', 'user_email', 'user_role', 'session_ts']
      .forEach(function (k) { sessionStorage.removeItem(k); });
  }

  // ── Namespace global ──────────────────────────────────────────
  global.CEB = global.CEB || {};
  global.CEB.normalizeText = normalizeText;
  global.CEB.showToast     = showToast;
  global.CEB.clearSession  = clearSession;

}(window));
