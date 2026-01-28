// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// --- CONTENIDO MARKDOWN PARA PRUEBAS ---
const RICH_ARTICLE_CONTENT = `
La terapia no es solo "hablar de problemas", es un proceso activo de reestructuración cognitiva. A continuación, desmitificamos los puntos más comunes.

## 1. "La terapia es para gente 'loca'"
Falso. La terapia es para **cualquier persona** que quiera mejorar su calidad de vida.

> "La vulnerabilidad no es ganar o perder; es tener el coraje de presentarse y ser visto cuando no tenemos control sobre el resultado."
> — *Brené Brown*

## 2. El proceso lógico del cambio
En la Terapia Cognitivo-Conductual (TCC), analizamos los patrones de pensamiento. Observa este ejemplo lógico de cómo procesamos un pensamiento automático:

\`\`\`javascript
// Ejemplo: Reestructuración Cognitiva
const pensamientoAutomatico = "Seguro les caigo mal a todos";

function analizarEvidencia(pensamiento) {
  if (pensamiento.esRealista === false) {
    return "Es una distorsión cognitiva (Lectura de mente)";
  }
  return "Es un hecho";
}

console.log(analizarEvidencia(pensamientoAutomatico));
\`\`\`

## 3. Herramientas que usamos
* **Diario de gratitud:** Para cambiar el foco atencional.
* **Exposición gradual:** Para tratar fobias.
* **Mindfulness:** Para el control de la ansiedad.

![Paisaje relajante](https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80)
`;

async function hashPassword(plain) {
  // NOTA: Asegúrate de instalar bcryptjs: pnpm add bcryptjs
  const bcrypt = require('bcryptjs'); 
  const saltRounds = 10;
  return await bcrypt.hash(plain, saltRounds);
}

async function main() {
  console.log('— Start seeding...');

  // 1) Generación de contraseñas (Usando Carolina3004!)
  const GLOBAL_PASSWORD = 'Carolina3004!';
  const passwordHash = await hashPassword(GLOBAL_PASSWORD);
  
  // --- SECCIÓN: SUPER ADMIN ---
  console.log('🌱 Sembrando Admin...');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@crm-smcr.com' },
    update: { 
        role: 'ADMIN',
        passwordHash: passwordHash // Actualizamos la pass si ya existía
    }, 
    create: {
      email: 'admin@crm-smcr.com',
      name: 'Super Admin',
      passwordHash: passwordHash,
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  console.log(`✅ Admin creado: ${adminUser.email} (Pass: ${GLOBAL_PASSWORD})`);

  // 2) Profesionales
  console.log('🌱 Sembrando Profesionales...');
  const prosData = [
    { email: 'ana.perez@example.com', name: 'Dra. Ana Pérez', profession: 'Psicóloga Clínica', introVideoUrl: 'https://www.youtube.com/embed/O-6f5wQXSu8' },
    { email: 'carlos.rojas@example.com', name: 'Lic. Carlos Rojas', profession: 'Nutricionista' },
    { email: 'laura.fernandez@example.com', name: 'Laura Fernández', profession: 'Coach de Carrera' },
    { email: 'sofia.vargas@example.com', name: 'MSc. Sofia Vargas', profession: 'Terapeuta Ocupacional' },
  ];

  const pros = {};
  for (const p of prosData) {
    const pro = await prisma.professional.upsert({
      where: { email: p.email },
      update: {
        name: p.name,
        profession: p.profession,
        introVideoUrl: p.introVideoUrl ?? null,
        passwordHash, // Usa Carolina3004!
        isApproved: true,
      },
      create: {
        email: p.email,
        name: p.name,
        profession: p.profession,
        introVideoUrl: p.introVideoUrl ?? null,
        passwordHash, // Usa Carolina3004!
        isApproved: true,
      },
      select: { id: true, email: true, name: true },
    });
    pros[p.email] = pro;
  }

  // 3) Servicios
  console.log('🌱 Sembrando Servicios...');
  const servicesData = [
    {
      slug: 'terapia-cognitivo-conductual',
      title: 'Terapia Cognitivo-Conductual',
      description: 'Enfoque práctico y basado en evidencia para tratar la ansiedad y la depresión.',
      price: 50,
      imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1888',
      professionalEmails: ['ana.perez@example.com'],
    },
    {
      slug: 'asesoria-nutricional',
      title: 'Asesoría Nutricional',
      description: 'Plan alimenticio personalizado para tus metas de salud.',
      price: 45,
      imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?q=80&w=2070',
      professionalEmails: ['carlos.rojas@example.com'],
    },
    {
      slug: 'coaching-de-carrera',
      title: 'Coaching de Carrera',
      description: 'Define y alcanza tus objetivos profesionales con un plan claro.',
      price: 60,
      imageUrl: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070',
      professionalEmails: ['laura.fernandez@example.com'],
    },
    {
      slug: 'terapia-ocupacional-infantil',
      title: 'Terapia Ocupacional Infantil',
      description: 'Apoyo especializado para el desarrollo de habilidades en niños.',
      price: 55,
      imageUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?q=80&w=1974',
      professionalEmails: ['sofia.vargas@example.com'],
    },
  ];

  const services = {};
  for (const s of servicesData) {
    const svc = await prisma.service.upsert({
      where: { slug: s.slug },
      update: { title: s.title, description: s.description, price: s.price, imageUrl: s.imageUrl },
      create: { slug: s.slug, title: s.title, description: s.description, price: s.price, imageUrl: s.imageUrl },
      select: { id: true, slug: true },
    });
    services[s.slug] = svc;

    const connects = (s.professionalEmails || [])
      .map((email) => pros[email]?.id)
      .filter(Boolean)
      .map((id) => ({ id }));

    if (connects.length) {
      await prisma.service.update({
        where: { id: svc.id },
        data: { professionals: { connect: connects } },
      });
    }
  }

  // 4) Posts (Con contenido Markdown enriquecido)
  console.log('🌱 Sembrando Posts...');
  const postsData = [
    {
      slug: 'mitos-terapia',
      title: '5 Mitos Comunes sobre la Terapia',
      content: RICH_ARTICLE_CONTENT,
      imageUrl: 'https://images.unsplash.com/photo-1527137342181-19aab11a8ee8?q=80&w=2070',
      postType: 'ARTICLE',
      authorEmail: 'ana.perez@example.com',
      serviceSlug: 'terapia-cognitivo-conductual',
      status: 'PUBLISHED',
    },
    {
      slug: 'video-mindfulness',
      title: 'Video: Guía de 5 minutos de Mindfulness',
      content: 'Sigue esta guía en video para una sesión rápida de relajación y reconexión.',
      postType: 'VIDEO',
      mediaUrl: 'https://www.youtube.com/embed/inpok4MKVLM',
      authorEmail: 'ana.perez@example.com',
      serviceSlug: 'terapia-cognitivo-conductual',
      status: 'PUBLISHED',
    },
    {
      slug: 'podcast-nutricion',
      title: 'Podcast: Nutrición y Estado de Ánimo',
      content: 'Escucha nuestro último episodio sobre cómo los alimentos afectan tu química cerebral.',
      postType: 'AUDIO',
      mediaUrl: 'https://open.spotify.com/embed/episode/43d8s7g8s9s?theme=0',
      authorEmail: 'carlos.rojas@example.com',
      serviceSlug: 'asesoria-nutricional',
      status: 'PUBLISHED',
    },
  ];

  for (const p of postsData) {
    const author = pros[p.authorEmail];
    const service = services[p.serviceSlug];

    await prisma.post.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        content: p.content,
        imageUrl: p.imageUrl ?? null,
        postType: p.postType,
        mediaUrl: p.mediaUrl ?? null,
        status: p.status || 'PENDING',
        authorId: author?.id,
        serviceId: service?.id ?? null,
      },
      create: {
        slug: p.slug,
        title: p.title,
        content: p.content,
        imageUrl: p.imageUrl ?? null,
        postType: p.postType,
        mediaUrl: p.mediaUrl ?? null,
        status: p.status || 'PENDING',
        authorId: author?.id,
        serviceId: service?.id ?? null,
      },
    });
  }

  console.log('— Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });