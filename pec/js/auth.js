// pec/js/auth.js

(function() {
    // Verificar si hay una sesión activa en sessionStorage
    const authRecord = sessionStorage.getItem('tutorias_auth');
    const userEmail = sessionStorage.getItem('user_email');

    // Si no está autenticado o no tiene email, redirigir
    if ((!authRecord || !userEmail) && !window.location.pathname.includes('login.html')) {
        sessionStorage.removeItem('tutorias_auth');
        window.location.href = 'login.html';
    }

    // Función para Cerrar Sesión
    window.logout = function() {
        sessionStorage.removeItem('tutorias_auth');
        sessionStorage.removeItem('user_name');
        sessionStorage.removeItem('user_email');
        sessionStorage.removeItem('user_role');
        window.location.href = 'login.html';
    };
})();
