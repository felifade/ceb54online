// pec/js/auth.js

(function() {
    const SESSION_MAX = 8 * 60 * 60 * 1000; // 8 horas en ms

    const authRecord = sessionStorage.getItem('tutorias_auth');
    const userEmail  = sessionStorage.getItem('user_email');
    const sessionTs  = parseInt(sessionStorage.getItem('session_ts') || '0', 10);
    const expired    = !sessionTs || (Date.now() - sessionTs) > SESSION_MAX;

    function clearSession() {
        sessionStorage.removeItem('tutorias_auth');
        sessionStorage.removeItem('user_name');
        sessionStorage.removeItem('user_email');
        sessionStorage.removeItem('user_role');
        sessionStorage.removeItem('session_ts');
    }

    if (!authRecord || !userEmail || expired) {
        clearSession();
        window.location.href = '../docente2/index.html';
    }

    window.logout = function() {
        clearSession();
        window.location.href = '../docente2/index.html';
    };
})();
