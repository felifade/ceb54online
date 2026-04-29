// pec/js/mock-data.js
// Estos datos simulan la estructura que leeremos de Google Sheets.

const MOCK_DATA = {
    // Lista de grupos inscritos en el PEC
    grupos: ["201", "202", "203", "204", "205", "206"],
    
    // Lista de equipos y vínculos al documento (PEC)
    equipos: [
        {
            id: "E-201-1",
            nombre: "Guardianes Verdes",
            grupo: "201",
            tema: "Reciclaje en el entorno escolar",
            integrantes: ["Pérez Juan", "López María", "Gómez Ana", "Ruiz Luis"],
            urlDoc: "https://docs.google.com/document/d/mock-doc-1/edit",
            estado: "Pendiente" // Pendiente o Evaluado
        },
        {
            id: "E-201-2",
            nombre: "Innovadores CEB",
            grupo: "201",
            tema: "Impacto del acoso escolar",
            integrantes: ["García Carlos", "Martínez Sofía"],
            urlDoc: "https://docs.google.com/document/d/mock-doc-2/edit",
            estado: "Evaluado"
        },
        {
            id: "E-202-1",
            nombre: "Mentes Sanas",
            grupo: "202",
            tema: "Salud mental post-pandemia",
            integrantes: ["Torres Diana", "Flores Ricardo", "Ramírez Julia"],
            urlDoc: "https://docs.google.com/document/d/mock-doc-3/edit",
            estado: "Pendiente"
        },
        {
            id: "E-203-1",
            nombre: "Comunidad Segura",
            grupo: "203",
            tema: "Seguridad peatonal escolar",
            integrantes: ["Sánchez Miguel", "Díaz Elena"],
            urlDoc: "https://docs.google.com/document/d/mock-doc-4/edit",
            estado: "Evaluado"
        }
    ],

    // Historial de evaluaciones (Simulación de la base de datos de calificaciones guardadas)
    evaluaciones: [
        {
            fecha: "2026-03-26 10:30:00",
            grupoId: "201",
            equipoId: "E-201-2",
            equipoNombre: "Innovadores CEB",
            docente: "Profr. Juan Pérez",
            materia: "Metodología de la Investigación",
            puntaje: 8.5,
            observaciones: "Buen abordaje del problema, falta detallar marco teórico."
        },
        {
            fecha: "2026-03-26 11:15:00",
            grupoId: "203",
            equipoId: "E-203-1",
            equipoNombre: "Comunidad Segura",
            docente: "Mtra. Ana Gómez",
            materia: "Ética II",
            puntaje: 9.0,
            observaciones: "Excelente enfoque ético y ciudadano."
        }
    ]
};
