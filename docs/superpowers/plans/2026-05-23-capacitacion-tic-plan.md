# Plan de Implementación: Experiencia Interactiva "TIC — CEB 5/4"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la landing page interactiva premium para la capacitación de TIC bajo el subdirectorio `/tics/` de `ceb54.online`, extendiendo el shell interactivo de comandos con una base de datos encriptada en local y animada.

**Architecture:** Módulo estático autocontenido bajo la ruta `/tics/index.html` con variables de estilo de neón, canvas interactivo para partículas y un CLI JavaScript enriquecido con persistencia `localStorage`.

**Tech Stack:** HTML5, CSS3 Custom Properties (cyberpunk theme toggle), JavaScript Vanilla, Canvas API, FontAwesome CDN, Google Fonts (Orbitron, Rajdhani, JetBrains Mono).

---

### Task 1: Preparación del Directorio y Copia de Archivos

**Files:**
- Create: `tics/index.html`
- Verify: `/Users/felipelopezsalazar/Downloads/CONALEP/Portal CONALEP/ceb54/capacitacion/index.html`

- [ ] **Step 1: Crear el directorio `tics` en la raíz del espacio de trabajo**
  Run: `mkdir -p tics`
  Expected: Directorio creado exitosamente.

- [ ] **Step 2: Copiar el index.html original de la carpeta externa a la carpeta local**
  Run: `cp "/Users/felipelopezsalazar/Downloads/CONALEP/Portal CONALEP/ceb54/capacitacion/index.html" tics/index.html`
  Expected: Archivo copiado exitosamente.

- [ ] **Step 3: Cambiar la referencia del dominio en el archivo copiado**
  Modify: `tics/index.html` en la línea 1416 y similar para que use el nuevo dominio `https://ceb54.online/tics/` en lugar del dominio de GitHub Pages anterior.
  Búscase: `const SITE_URL='https://felifade.github.io/Portal-CONALEP/ceb54/capacitacion/';`
  Reemplácese con: `const SITE_URL='https://ceb54.online/tics/';`

- [ ] **Step 4: Commit**
  ```bash
  git add tics/index.html
  git commit -m "feat: setup tics directory and baseline files"
  ```

---

### Task 2: Modificación del Parser de la Terminal Interactiva (Soporte de Argumentos)

**Files:**
- Modify: `tics/index.html` (Lógica de la terminal en el script, líneas ~1363 a ~1380)

- [ ] **Step 1: Reemplazar el event listener de `termInput` para admitir comandos con argumentos**
  Búscase el bloque:
  ```javascript
  if(termInput){
    termInput.addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;
      const val=termInput.value.trim().toLowerCase();
      termInput.value='';
      const echo=document.createElement('div');
      echo.className='term-line prompt';echo.textContent=val;
      termBody.appendChild(echo);
      if(CMD[val])termPrint(CMD[val].lines);
      else{
        const err=document.createElement('div');
        err.className='term-line err';
        err.textContent=`Comando '${val}' no encontrado. Escribe 'help'.`;
        termBody.appendChild(err);
      }
      termBody.scrollTop=termBody.scrollHeight;
    });
  }
  ```
  Reemplácese con el parser extendido con soporte para comandos dinámicos y argumentos:
  ```javascript
  if(termInput){
    termInput.addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;
      const val=termInput.value.trim();
      termInput.value='';
      
      const echo=document.createElement('div');
      echo.className='term-line prompt';
      echo.textContent=val;
      termBody.appendChild(echo);
      
      // Parsear comando y argumentos
      const parts = val.split(' ');
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ');
      
      if (cmd === 'secret') {
        handleSecretCommand(arg);
      } else if (cmd === 'secrets') {
        handleSecretsListCommand();
      } else if (cmd === 'clearsecrets') {
        handleClearSecretsCommand();
      } else if(CMD[cmd]) {
        termPrint(CMD[cmd].lines);
      } else {
        const err=document.createElement('div');
        err.className='term-line err';
        err.textContent=`Comando '${cmd}' no encontrado. Escribe 'help'.`;
        termBody.appendChild(err);
      }
      termBody.scrollTop=termBody.scrollHeight;
    });
  }
  ```

- [ ] **Step 2: Actualizar el comando `help` para documentar las nuevas funciones de encriptación y desencriptación**
  Búscase el bloque:
  ```javascript
    help:{lines:[
      {t:'cyan',v:'Comandos disponibles:'},
      {t:'out',v:'  help     → esta lista'},
      {t:'out',v:'  careers  → carreras y salarios'},
      {t:'out',v:'  skills   → habilidades que aprenderás'},
      {t:'out',v:'  enroll   → cómo elegir TIC'},
      {t:'out',v:'  matrix   → 👀'},
      {t:'out',v:'  secret   → easter egg'},
    ]},
  ```
  Reemplácese con:
  ```javascript
    help:{lines:[
      {t:'cyan',v:'Comandos disponibles:'},
      {t:'out',v:'  help         → esta lista'},
      {t:'out',v:'  careers      → carreras y salarios'},
      {t:'out',v:'  skills       → habilidades que aprenderás'},
      {t:'out',v:'  enroll       → cómo elegir TIC'},
      {t:'out',v:'  matrix       → 👀'},
      {t:'out',v:'  secret       → ver secreto de la capacitación'},
      {t:'warn',v:'  ── NUEVOS COMANDOS CLASIFICADOS ──'},
      {t:'cyan',v:'  secret <msg> → encripta y guarda un secreto local'},
      {t:'cyan',v:'  secrets      → lista y desencripta tus secretos guardados'},
      {t:'cyan',v:'  clearsecrets → borra el registro de secretos locales'},
    ]},
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add tics/index.html
  git commit -m "feat: implement shell argument parsing and help docs"
  ```

---

### Task 3: Implementación de la Encriptación y Persistencia de Secretos (localStorage)

**Files:**
- Modify: `tics/index.html` (Lógica de JS, al final del script antes de `</script>`)

- [ ] **Step 1: Agregar las funciones `handleSecretCommand`, `handleSecretsListCommand` y `handleClearSecretsCommand`**
  Agréguese al final del script:
  ```javascript
  // Lógica de encriptación de base64 simple con carácteres especiales de cyber-glitch
  function encryptMessage(msg) {
    return btoa(unescape(encodeURIComponent(msg)));
  }

  function decryptMessage(cipher) {
    try {
      return decodeURIComponent(escape(atob(cipher)));
    } catch(e) {
      return "[CORRUPTED DATA]";
    }
  }

  function handleSecretCommand(arg) {
    if (!arg || arg.trim() === '') {
      termPrint([
        {t:'err', v:'ERROR: El comando requiere un mensaje secreto.'},
        {t:'warn', v:'Uso: secret <mensaje sobre la capacitación>'},
        {t:'out', v:'Ejemplo: secret Me encanta programar en las clases de Felipe'}
      ]);
      return;
    }

    const rawMsg = arg.trim();
    const encrypted = encryptMessage(rawMsg);
    const dateStr = new Date().toLocaleString();

    // Guardar en localStorage
    let currentSecrets = JSON.parse(localStorage.getItem('tic_secrets') || '[]');
    currentSecrets.push({ id: Date.now(), msg: encrypted, date: dateStr });
    localStorage.setItem('tic_secrets', JSON.stringify(currentSecrets));

    // Animación hacker en consola
    termPrint([
      {t:'warn', v:'Cargando codificador cuántico...'},
      {t:'cyan', v:'Codificando: ' + rawMsg.slice(0, 15) + (rawMsg.length > 15 ? '...' : '')},
      {t:'cyan', v:'Cifrado Hash: ' + encrypted.slice(0, 12) + '...'},
      {t:'success', v:'[OK] Secreto encriptado y persistido en el chip local con éxito.'}
    ]);
  }

  function handleSecretsListCommand() {
    const secrets = JSON.parse(localStorage.getItem('tic_secrets') || '[]');
    if (secrets.length === 0) {
      termPrint([
        {t:'warn', v:'El chip de memoria está vacío.'},
        {t:'out', v:'No hay secretos locales registrados todavía.'},
        {t:'cyan', v:'Crea uno escribiendo: secret <tu mensaje>'}
      ]);
      return;
    }

    termPrint([
      {t:'cyan', v:'── LISTA DE ARCHIVOS CLASIFICADOS (LOCAL) ──'},
      {t:'warn', v:'Desencriptando base de datos cuántica en tiempo real...'}
    ]);

    secrets.forEach((s, idx) => {
      setTimeout(() => {
        const decrypted = decryptMessage(s.msg);
        
        // Crear elementos de desencriptación progresiva
        const container = document.createElement('div');
        container.className = 'term-line out';
        
        const prefix = document.createElement('span');
        prefix.style.color = 'var(--cyan)';
        prefix.textContent = `[Archivo ${idx + 1}] (${s.date}) Cifrado: ${s.msg.slice(0, 8)}... → `;
        container.appendChild(prefix);
        
        const textSpan = document.createElement('span');
        textSpan.style.color = '#ff9900';
        textSpan.textContent = '[DECRYPTING...]';
        container.appendChild(textSpan);
        
        termBody.appendChild(container);
        termBody.scrollTop = termBody.scrollHeight;
        
        // Efecto visual de desencriptado secuencial de carácteres
        let iter = 0;
        const glitchChars = '!@#$%^&*()_+{}[]|:<>?;';
        const finalWord = decrypted;
        
        const interval = setInterval(() => {
          if (iter >= 5) {
            textSpan.textContent = finalWord;
            textSpan.style.color = '#27c93f';
            clearInterval(interval);
          } else {
            let temp = "";
            for(let k=0; k < finalWord.length; k++) {
              temp += glitchChars[Math.floor(Math.random() * glitchChars.length)];
            }
            textSpan.textContent = temp.slice(0, 12) + '...';
            iter++;
          }
        }, 120);
        
      }, idx * 600);
    });
  }

  function handleClearSecretsCommand() {
    localStorage.removeItem('tic_secrets');
    termPrint([
      {t:'err', v:'[DANGER] Iniciando protocolo de borrado absoluto...'},
      {t:'warn', v:'Borrando registros del chip de memoria local...'},
      {t:'success', v:'[OK] Memoria purgada. Todos los secretos locales han sido eliminados.'}
    ]);
  }
  ```

- [ ] **Step 2: Verificación de la compilación y pruebas de la terminal en el navegador**
  Probar localmente en la terminal escribiendo los comandos:
  `secret Hola este es un mensaje secreto sobre TIC`
  `secrets`
  `clearsecrets`
  `secrets`
  Verificar que el scroll de la terminal no se rompa y las animaciones fluyan hermosamente.

- [ ] **Step 3: Commit**
  ```bash
  git add tics/index.html
  git commit -m "feat: complete secret messages encryption, decryption and local persistence"
  ```

---

### Task 4: Validación y Preparación para el Despliegue en ceb54.online/tics/

- [ ] **Step 1: Comprobación de integridad del index.html**
  Comprobar que todas las etiquetas HTML estén cerradas y que el modo claro y oscuro alternen perfectamente al hacer clic en el botón inferior derecho.

- [ ] **Step 2: Proporcionar instrucciones para subir el código a GitHub**
  Explicar detalladamente al usuario cómo realizar el comando `git push` para desplegar la carpeta `tics` a producción y que quede lista en `https://ceb54.online/tics/`.
