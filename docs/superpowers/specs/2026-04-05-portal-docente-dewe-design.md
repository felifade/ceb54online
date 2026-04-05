# Especificación de Diseño: Portal Docente Profesional — CONALEP DEWE-20

## 1. Objetivo del Proyecto
Crear una plataforma web profesional para la gestión académica del módulo "Elaboración de Páginas Web" (DEWE-20) en CONALEP Pachuca II. El sistema debe permitir al docente organizar el contenido por Resultados de Aprendizaje (RA) y Semanas, siguiendo la metodología institucional de 10m Teoría, Actividad en Libreta y Práctica en Computadora.

## 2. Identidad Visual (Branding CONALEP)
- **Primary Green**: `#006341` (Encabezados, Sidebar, Botones principales).
- **Secondary Green (Light)**: `#d9efe4` (Fondos de tarjetas, acentos).
- **Surface/Background**: `#f3f8f5` (Fondo general de la aplicación).
- **Text Color**: `#0b3d2c` (Contraste alto).
- **Typography**: Fuentes modernas (Inter/Outfit) para un look tipo sistema real (Notion/Google Docs).

## 3. Arquitectura de Navegación
- **Sidebar (Lateral Izquierdo)**:
  - Selector de Resultados de Aprendizaje (RAs).
  - Árbol jerárquico de semanas (ej. RA 2.1 > Semana 07).
  - Estado: El sidebar debe ser colapsable en dispositivos móviles.
- **Main Content (Área Central)**:
  - Visualización de la semana seleccionada.
  - Título dinámico por semana y tema.
  - Botón "Expandir / Contraer todo".

## 4. Componentes Funcionales
### 4.1. `WeekView` (Contenedor de Semana)
Visualiza los días de clase: Lunes, Jueves (Dual) y Viernes.

### 4.2. `DayCard` (Tarjeta por Día)
- Título del día con número de horas y grupo.
- Subsecciones desplegables (Acordeón):
  - **Teoría (10 min)**: Texto del dictado o conceptos clave.
  - **Actividad en Libreta**: Instrucciones detalladas.
  - **Actividad Práctica**: Guía para la computadora + Bloque de código.
  - **Dual Activity**: Actividad específica para alumnos en modelo dual.

### 4.3. `CodeBlock` (Visor de Código)
- Implementación de `react-syntax-highlighter` con tema profesional.
- Botón de "Copiar al portapapeles".

## 5. Estructura de Datos (Separación Logic/UI)
- **`module_data.js`**: Archivo central que contendrá un objeto JSON con toda la planeación:
  ```json
  [
    {
      "ra": "2.1",
      "descripcion": "Implementa hojas de estilo...",
      "weeks": [
        {
          "number": 7,
          "topic": "Maquetación CSS Avanzada",
          "days": {
            "lunes": { "theory": "...", "notebook": "...", "practice": "...", "code": "..." },
            "jueves": { ... },
            "viernes": { ... }
          }
        }
      ]
    }
  ]
  ```

## 6. Stack Tecnológico
- **Core**: React 18+ (Vite).
- **Estilos**: Vanilla CSS con Variables (CSS Modules opcional).
- **Iconos**: Lucide-React.
- **Utilidades**: Syntax Highlighter para código.

## 7. Plan de Implementación (Fases)
1. Escalamiento del proyecto en `conalep/DEWE`.
2. Creación del sistema de diseño (CSS Variables).
3. Implementación de la estructura de datos (`data/module_data.js`).
4. Desarrollo de componentes base (Sidebar, Layout).
5. Integración de vistas dinámicas y funcionalidad de copia de código.
