# Especificación de Diseño: Experiencia Interactiva "Capacitación TIC CEB 5/4"

Este documento detalla la estructura y el comportamiento de la landing page interactiva de alta fidelidad para la capacitación de Tecnologías de la Información y la Comunicación (TIC) del CEB 5/4 "Profr. Rafael Ramírez".

El sitio se creará en la carpeta `/capacitacion` y se basará en la estructura existente proporcionada por el docente, enriqueciéndola con un sistema interactivo de mensajes secretos encriptados con `localStorage`.

---

## 🎯 1. Objetivos del Sistema
- **Enganchar a los Alumnos de 2do Semestre:** Ofrecer una estética visual premium y futurista tipo Cyberpunk/HUD Gamer que se aleje del formato escolar tradicional.
- **Venta de la Capacitación:** Mostrar las materias como "habilidades desbloqueables" y destacar carreras de alta demanda y salarios visualmente atractivos.
- **Interactividad Práctica:** Integrar un shell/terminal de comandos funcional que permita experimentar con el desarrollo real en tiempo real.
- **Persistencia de Mensajes Secretos:** Permitir que los alumnos dejen sus propios secretos encriptados localmente en su dispositivo (`localStorage`), simulando una consola hacker real.

---

## 🎨 2. Estilo Visual y Paleta de Colores
Inspirado en la ciencia ficción elegante y en HUDs de videojuegos premium:
- **Fondo:** Negro profundo (`#06060e`) con partículas flotantes animadas en canvas 2D.
- **Acento Primario:** Azul Eléctrico / Cyan brillante (`#00d4ff`) con efectos de resplandor (glow).
- **Acento Secundario:** Morado Neón (`#7b2fff`) y Rosa Cyberpunk (`#ff006e`).
- **Modo Claro:** Esquema de color invertido fluido con contrastes nítidos basados en HSL (tonalidades suaves en cian y morado profundo).
- **Tipografías:**
  - *Orbitron:* Para títulos técnicos, botones y logos.
  - *Rajdhani:* Para el cuerpo del texto para asegurar excelente lectura a cualquier tamaño.
  - *JetBrains Mono:* Para bloques de código, terminal y textos de sistema.

---

## 🧠 3. Estructura y Secciones del Contenido
El sitio web constará de una arquitectura vertical de una sola página (Single Page Application) fluida con las siguientes secciones principales:

1. **Loader Inicial:** Pantalla de carga animada con escáner holográfico tipo juego.
2. **Intro Épica:** Espectacular título "El futuro no lo usan los demás. Lo programan." con efecto Glitch y partículas animadas de fondo.
3. **Nexo TIC (¿Qué es?):** Dos columnas interactivas: texto juvenil no aburrido a la izquierda y mini visualizaciones HUD de métricas a la derecha.
4. **Materias (Skill Tree):** 7 tarjetas 3D (tilt effect) e iluminación holográfica que representan las asignaturas reales (Programación, Páginas Web, Comunidades Virtuales, etc.) como niveles desbloqueables en un RPG.
5. **Showcase "Lo que Podrás Crear":** Galería en 3D interactiva que simula interfaces de videojuegos, webs modernas, apps móviles, diseño digital, modelos de IA y transmisiones de streaming.
6. **Universo TIC (Carrusel Horizontal):** 5 paneles interactivos desplazables horizontalmente que sumergen al usuario en los mundos de la informática.
7. **Filosofía y Empleos (Spotify Wrapped):** Gráfico interactivo con las carreras de futuro (IA, Ciberseguridad, UX/UI, Videojuegos) y sus espectaculares salarios asociados.
8. **TIC para Todos:** Demostración práctica de cómo las TIC impulsan cualquier profesión (Administración, Medicina, Deporte, Gastronomía, Arte, etc.).
9. **Terminal de Comandos Interactiva:** El motor interactivo principal que simula un shell de comandos linux cyberpunk.
10. **Sección del Docente:** Firma premium y elegante de presentación del docente **Prof. Felipe López Salazar**.
11. **Final Épico con Botón "🚀 ELEGIR TIC":** Pantalla cinematográfica final con pulsaciones y animaciones expansivas al dar clic.

---

## 🖥️ 4. Especificación Técnica: Módulo de Mensajes Secretos (localStorage)
El shell/terminal existente se extenderá añadiendo soporte interactivo completo para la encriptación y desencriptación de mensajes secretos.

### Comandos del Terminal
1. `secret "<mensaje>"` o `write "<mensaje>"`:
   - Toma el mensaje provisto.
   - Aplica una codificación/cifrado interactivo (por ejemplo, Base64 o binario con símbolos cibernéticos).
   - Genera una animación interactiva en el terminal que muestra caracteres aleatorios antes de consolidar el texto cifrado.
   - Guarda el objeto en una lista dentro de `localStorage` (`tic_secrets`) con la estructura:
     `{ id: timestamp, message: cipherText, date: currentDate }`.
   - Imprime un mensaje de éxito: `[OK] Archivo cifrado y almacenado en el registro secreto local.`
2. `secrets` o `read`:
   - Lee todos los secretos almacenados en `localStorage`.
   - Si no hay secretos, muestra un mensaje amigable invitando a escribir uno.
   - Si hay secretos, los imprime uno a uno, mostrando primero la versión encriptada y luego activando una animación de descifrado secuencial en la pantalla de la terminal en 1.5 segundos.
3. `clearsecrets` o `delete`:
   - Borra todos los secretos guardados en `localStorage` con confirmación hacker de seguridad.

---

## 🛠️ 5. Plan de Verificación y Pruebas
1. **Verificación de Copia y Rutas:** Asegurar que todos los recursos, clases CSS y lógica de Javascript se ejecuten perfectamente bajo la ruta `/capacitacion/`.
2. **Prueba de Modo Claro y Oscuro:** Hacer clic en el toggle del tema y verificar que todas las secciones modifiquen sus colores de forma fluida y sin rotura de contraste visual.
3. **Prueba de Terminal e Input:** Digitar cada comando en la terminal (`help`, `careers`, `skills`, `enroll`, `matrix`, `secret`, `write`, `secrets`) y verificar que respondan adecuadamente y que el scroll automático funcione.
4. **Verificación de localStorage:** Abrir las herramientas de desarrollador y verificar que al escribir un secreto con `secret` se cree la llave correcta en el almacenamiento local y se persista al recargar la página.
