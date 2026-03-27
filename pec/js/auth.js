// pec/js/auth.js

(function() {
    // Verificar si hay una sesión activa en sessionStorage (Clave compartida con Tutorías)
    const authRecord = sessionStorage.getItem('tutorias_auth');
    
    // Si no está autenticado y no estamos en la página de login, redirigir
    if (!authRecord && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }

    // Función para Cerrar Sesión
    window.logout = function() {
        sessionStorage.removeItem('tutorias_auth');
        sessionStorage.removeItem('user_name');
        window.location.href = 'login.html';
    };
})();
