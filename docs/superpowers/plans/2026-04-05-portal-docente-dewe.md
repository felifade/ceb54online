# Portal Docente Profesional (DEWE-20) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un portal docente profesional desde cero para el módulo DEWE-20 en CONALEP Pachuca II, organizado por RAs y semanas con metodología institucional.

**Architecture:** Aplicación React (Vite) modular con separación clara entre datos (capa de contenido) y componentes de UI (layout, sidebar, acordeones).

**Tech Stack:** React 18, Vite, Lucide-React (iconos), React Syntax Highlighter (código), CSS Vanilla (Variables).

---

### Task 1: Project Scaffolding & Design System

**Files:**
- Create: `conalep/DEWE/package.json`
- Create: `conalep/DEWE/vite.config.js`
- Create: `conalep/DEWE/src/styles/theme.css`

- [ ] **Step 1: Create package.json with dependencies**
```json
{
  "name": "dewe-portal",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.284.0",
    "react-syntax-highlighter": "^15.5.0",
    "clsx": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.0.3",
    "vite": "^4.4.5"
  }
}
```

- [ ] **Step 2: Create vite.config.js**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: './',
  server: {
     port: 3000
  }
})
```

- [ ] **Step 3: Define Design System in theme.css**
```css
:root {
  --conalep-green: #006341;
  --conalep-green-dark: #0b3d2c;
  --conalep-green-light: #d9efe4;
  --bg-surface: #f3f8f5;
  --text-main: #0b3d2c;
  --white: #ffffff;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.12);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --radius-md: 8px;
  --font-main: 'Inter', system-ui, sans-serif;
}

body {
  margin: 0;
  font-family: var(--font-main);
  background-color: var(--bg-surface);
  color: var(--text-main);
}
```

---

### Task 2: Data layer & Core Component (Layout)

**Files:**
- Create: `conalep/DEWE/src/data/module_data.js`
- Create: `conalep/DEWE/src/components/Layout.jsx`

- [ ] **Step 1: Populate module_data.js with Semana 07**
```javascript
export const MODULE_DATA = [
  {
    ra: "2.1",
    title: "Implementación de Hojas de Estilo (CSS)",
    weeks: [
      {
        id: "7",
        topic: "Maquetación CSS Avanzada (Grid & Flexbox)",
        days: [
          {
            name: "Lunes",
            hours: 2,
            group: "601",
            methodology: {
              theory: "Introducción a CSS Grid: Contenedores, ítems y áreas. El dictado se enfocará en la diferencia entre Flexbox (1D) y Grid (2D).",
              notebook: "Dibujar el esquema de una página de noticias con Grid (Header, Sidebar, Main, Footer).",
              practice: "Crear un layout responsivo usando grid-template-areas.",
              code: ".container {\n  display: grid;\n  grid-template-columns: 1fr 3fr;\n  gap: 20px;\n}"
            }
          },
          {
            name: "Jueves",
            hours: 2,
            group: "601 (Dual)",
            methodology: {
              theory: "Consolidación de Flexbox para componentes internos del Layout.",
              notebook: "Infografía sobre alineación de ejes (justify-content vs align-items).",
              practice: "Maquetar una barra de navegación profesional.",
              dual: "Evidencia Dual: Reporte técnico sobre el uso de Flexbox en frameworks modernos.",
              code: ".nav {\n  display: flex;\n  justify-content: space-between;\n}"
            }
          }
        ]
      }
    ]
  }
];
```

- [ ] **Step 2: Create Layout.jsx structure**
```jsx
import React from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children, sidebarProps }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar {...sidebarProps} />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

---

### Task 3: Interactive UI Components (Sidebar & WeekView)

**Files:**
- Create: `conalep/DEWE/src/components/Sidebar.jsx`
- Create: `conalep/DEWE/src/components/WeekView.jsx`
- Create: `conalep/DEWE/src/components/DayCard.jsx`

- [ ] **Step 1: Implement Sidebar.jsx**
- [ ] **Step 2: Implement WeekView.jsx using DayCard**
- [ ] **Step 3: Implement DayCard with Accordion effect**

---

### Task 4: Code Block & Polish

**Files:**
- Create: `conalep/DEWE/src/components/CodeBlock.jsx`
- Modify: `conalep/DEWE/src/App.jsx`

- [ ] **Step 1: Implement CodeBlock with copy-to-clipboard**
- [ ] **Step 2: Finalize App.jsx state management**
- [ ] **Step 3: Verification - Run `npm run dev` and test responsiveness**
