// src/data/mockData.js

export const professionals = [
  {
    id: 1,
    name: 'Dra. Ana Pérez',
    role: 'Psicóloga Clínica',
  },
  {
    id: 2,
    name: 'Lic. Carlos Rojas',
    role: 'Nutricionista',
  },
  {
    id: 3,
    name: 'Laura Fernández',
    role: 'Coach de Carrera',
  }
];

export const posts = [
  {
    slug: 'mitos-terapia',
    title: '5 Mitos Comunes sobre la Terapia',
    excerpt: 'Desmentimos algunas de las ideas erróneas más frecuentes...',
    imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070',
    href: '/blog/mitos-terapia',
    authorId: 1,
    authorName: 'Dra. Ana Pérez'
  },
  // ... (los otros posts)
];

// ✅ ESTA ES LA PARTE QUE FALTABA
export const services = [
  {
    id: 1,
    title: 'Terapia Cognitivo-Conductual',
    professionalName: 'Dra. Ana Pérez',
    description: 'Enfoque práctico y basado en evidencia para tratar la ansiedad, la depresión y otros desafíos emocionales.',
    price: 50,
    imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1888',
  },
  {
    id: 2,
    title: 'Asesoría Nutricional',
    professionalName: 'Lic. Carlos Rojas',
    description: 'Desarrolla una relación saludable con la comida y alcanza tus metas de bienestar con un plan personalizado.',
    price: 45,
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2070',
  },
  {
    id: 3,
    title: 'Coaching de Carrera',
    professionalName: 'Laura Fernández',
    description: 'Define y alcanza tus objetivos profesionales con un plan claro y estrategias efectivas para tu crecimiento.',
    price: 60,
    imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070',
  },
  {
    id: 4,
    title: 'Terapia Ocupacional Infantil',
    professionalName: 'MSc. Sofia Vargas',
    description: 'Apoyo especializado para el desarrollo de habilidades motoras, sensoriales y de juego en niños.',
    price: 55,
    imageUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=1974',
  },
];