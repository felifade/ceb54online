/**
 * auth.js — Protección de acceso para el módulo Académico CEB 5/4
 * Se incluye en dashboard.html y upload.html
 * Versión 1.0 Producción
 */
(function () {
  'use strict';

  const KEY = 'cebAcadOk';
  const OK  = 'Y2ViNTRhZG1pbjIwMjY='; // acceso institucional

  // Si ya autenticó en esta sesión del navegador, no interrumpir
  if (sessionStorage.getItem(KEY) === '1') return;

  // Ocultar contenido de la página hasta autenticar
  const hideStyle = document.createElement('style');
  hideStyle.id    = 'auth-hide-style';
  hideStyle.textContent = 'body > *:not(#ceb-auth-wall) { visibility: hidden !important; }';
  document.head.appendChild(hideStyle);

  function buildWall() {
    // Estilos del muro
    const css = document.createElement('style');
    css.id    = 'auth-wall-style';
    css.textContent = `
      #ceb-auth-wall {
        position: fixed; inset: 0; z-index: 999999;
        background: linear-gradient(135deg, #0f172a 0%, #1a3a5e 55%, #3884C0 100%);
        display: flex; align-items: center; justify-content: center;
        font-family: 'Inter', 'Outfit', sans-serif;
        padding: 1rem;
      }
      .auth-card {
        background: rgba(255,255,255,0.06);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 1.5rem;
        padding: 2.75rem 2.25rem;
        width: 100%; max-width: 400px;
        text-align: center;
        box-shadow: 0 30px 60px rgba(0,0,0,0.5);
        animation: authSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes authSlideIn {
        from { opacity:0; transform: translateY(32px) scale(0.95); }
        to   { opacity:1; transform: translateY(0) scale(1); }
      }
      .auth-logo {
        width: 84px; height: 84px;
        background: rgba(56,132,192,0.25);
        border: 2px solid rgba(56,132,192,0.5);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        margin: 0 auto 1.5rem;
      }
      .auth-badge {
        display: inline-block;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: rgba(255,255,255,0.7);
        font-size: 0.75rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: 1.5px;
        padding: 0.35rem 1rem; border-radius: 9999px;
        margin-bottom: 1rem;
      }
      .auth-title {
        color: #fff;
        font-size: 1.8rem; font-weight: 800;
        font-family: 'Outfit', sans-serif;
        margin-bottom: 0.5rem;
      }
      .auth-sub {
        color: rgba(255,255,255,0.5);
        font-size: 0.9rem;
        margin-bottom: 2rem;
      }
      #auth-err {
        background: rgba(220,38,38,0.18);
        border: 1px solid rgba(220,38,38,0.35);
        color: #fca5a5;
        padding: 0.7rem 1rem;
        border-radius: 0.75rem;
        font-size: 0.875rem;
        margin-bottom: 1.25rem;
        text-align: left;
        display: none;
      }
      .auth-label {
        display: block;
        color: rgba(255,255,255,0.65);
        font-size: 0.82rem; font-weight: 600;
        text-align: left; margin-bottom: 0.5rem;
      }
      .auth-input-row {
        position: relative; margin-bottom: 1.25rem;
      }
      .auth-input-row input {
        width: 100%;
        padding: 0.9rem 3rem 0.9rem 1rem;
        background: rgba(255,255,255,0.08);
        border: 1.5px solid rgba(255,255,255,0.18);
        border-radius: 0.875rem;
        color: #fff; font-size: 1rem; outline: none;
        transition: border-color 0.2s, background 0.2s;
      }
      .auth-input-row input:focus {
        border-color: #3884C0;
        background: rgba(255,255,255,0.12);
      }
      .auth-input-row input::placeholder { color: rgba(255,255,255,0.28); }
      .auth-eye {
        position: absolute; right: 1rem; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer;
        font-size: 1.1rem; opacity: 0.55; transition: opacity 0.2s;
      }
      .auth-eye:hover { opacity: 1; }
      .auth-submit {
        width: 100%; padding: 0.95rem;
        background: #3884C0;
        border: none; border-radius: 0.875rem;
        color: #fff; font-size: 1rem; font-weight: 700;
        font-family: 'Outfit', sans-serif;
        cursor: pointer; transition: background 0.2s, transform 0.1s;
        margin-bottom: 1.25rem;
        letter-spacing: 0.3px;
      }
      .auth-submit:hover { background: #2d6fa5; }
      .auth-submit:active { transform: scale(0.98); }
      .auth-back {
        display: inline-block;
        color: rgba(255,255,255,0.4);
        font-size: 0.875rem;
        text-decoration: none;
        transition: color 0.2s;
      }
      .auth-back:hover { color: rgba(255,255,255,0.85); }
      @media (max-width: 480px) {
        .auth-card { padding: 2rem 1.25rem; }
        .auth-title { font-size: 1.5rem; }
      }
    `;
    document.head.appendChild(css);

    const wall = document.createElement('div');
    wall.id    = 'ceb-auth-wall';
    wall.innerHTML = `
      <div class="auth-card">
        <div class="auth-logo">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span class="auth-badge">Área Académica</span>
        <h2 class="auth-title">Acceso Restringido</h2>
        <p class="auth-sub">Solo personal autorizado del CEB 5/4</p>
        <div id="auth-err">Contraseña incorrecta. Verifica e inténtalo de nuevo.</div>
        <label class="auth-label" for="auth-pwd-input">Contraseña institucional</label>
        <div class="auth-input-row">
          <input type="password" id="auth-pwd-input" placeholder="••••••••••••" autocomplete="current-password">
          <button type="button" class="auth-eye" id="auth-eye-btn" title="Mostrar/ocultar">👁</button>
        </div>
        <button class="auth-submit" id="auth-submit-btn">Entrar al sistema</button>
        <a href="../acceso.html" class="auth-back">← Volver al portal</a>
      </div>
    `;
    document.body.appendChild(wall);

    // Ocultar contenido real mientras el muro está visible
    document.body.style.overflow = 'hidden';

    // Eventos
    document.getElementById('auth-pwd-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') checkPwd();
    });
    document.getElementById('auth-submit-btn').addEventListener('click', checkPwd);
    document.getElementById('auth-eye-btn').addEventListener('click', function () {
      const inp = document.getElementById('auth-pwd-input');
      inp.type  = inp.type === 'password' ? 'text' : 'password';
    });

    // Focus automático
    setTimeout(() => {
      const inp = document.getElementById('auth-pwd-input');
      if (inp) inp.focus();
    }, 150);
  }

  function checkPwd() {
    const inp = document.getElementById('auth-pwd-input');
    const err = document.getElementById('auth-err');
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) { inp.focus(); return; }

    if (btoa(val) === OK) {
      sessionStorage.setItem(KEY, '1');
      // Limpiar muros
      const wall = document.getElementById('ceb-auth-wall');
      const hs   = document.getElementById('auth-hide-style');
      const cs   = document.getElementById('auth-wall-style');
      if (wall) wall.remove();
      if (hs)   hs.remove();
      if (cs)   cs.remove();
      document.body.style.overflow = '';
    } else {
      err.style.display = 'block';
      inp.value = '';
      inp.focus();
      inp.closest('.auth-card') && inp.closest('.auth-card').classList.add('auth-shake');
      setTimeout(() => inp.closest('.auth-card') && inp.closest('.auth-card').classList.remove('auth-shake'), 600);
    }
  }

  // Exponer para uso desde acceso.html (no necesario aquí, pero útil)
  window.__cebAuthCheck = checkPwd;

  // Ejecutar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWall);
  } else {
    buildWall();
  }

})();
