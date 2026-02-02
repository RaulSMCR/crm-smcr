// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando siembra de datos (Seeding)...');

  // Contraseñas hasheadas
  const passwordAdmin = await bcrypt.hash('Admin123!', 10);
  const passwordPro = await bcrypt.hash('Password123!', 10);

  // --------------------------------------------------------
  // 1. CREAR EL ADMINISTRADOR
  // --------------------------------------------------------
  console.log('👤 Creando/Verificando Administrador...');
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@saludmental.com' },
    update: {}, 
    create: {
      email: 'admin@saludmental.com',
      name: 'Super Admin',
      password: passwordAdmin,
      role: 'ADMIN',
      phone: '000000000',
      isApproved: true,
      emailVerified: true,
      isActive: true,
    },
  });
  console.log(`✅ Admin listo: ${admin.email}`);

  // --------------------------------------------------------
  // 2. CATEGORÍAS (Para el Blog)
  // --------------------------------------------------------
  console.log('📂 Verificando Categorías...');
  
  const catSaludMental = await prisma.category.upsert({
    where: { slug: 'salud-mental' },
    update: {},
    create: { 
      name: 'Salud Mental', 
      slug: 'salud-mental',
      description: 'Artículos generales sobre bienestar.'
    }
  });
  console.log(`✅ Categoría lista: ${catSaludMental.name}`);

  // --------------------------------------------------------
  // 3. PROFESIONAL DE PRUEBA (User + Profile)
  // --------------------------------------------------------
  console.log('👩‍⚕️ Creando Profesional de prueba...');

  // 3.1. Primero creamos/buscamos el USUARIO
  const proUser = await prisma.user.upsert({
    where: { email: 'pro@test.com' },
    update: { isApproved: true }, // Asegurar que esté aprobado si ya existe
    create: {
      email: 'pro@test.com',
      name: 'Dr. Test House',
      password: passwordPro,
      role: 'PROFESSIONAL',
      phone: '8888-8888',
      isApproved: true,
      emailVerified: true,
      isActive: true,
      acquisitionChannel: 'Seed Script'
    }
  });

  // 3.2. Luego creamos/actualizamos su PERFIL PROFESIONAL
  // Usamos upsert en la tabla ProfessionalProfile usando userId como clave única
  const proProfile = await prisma.professionalProfile.upsert({
    where: { userId: proUser.id },
    update: {
      slug: 'dr-test-house',
      specialty: 'Psicólogo Clínico'
    },
    create: {
      userId: proUser.id, // Conexión clave
      slug: 'dr-test-house',
      specialty: 'Psicólogo Clínico',
      bio: 'Especialista en intervención clínica y psicopatología moderna.',
      commission: 15,
      rating: 5.0
    }
  });

  console.log(`✅ Perfil Profesional listo: ${proProfile.slug}`);

  // --------------------------------------------------------
  // 4. SERVICIOS Y CONTENIDO
  // --------------------------------------------------------
  console.log('💼 Agregando Servicios y Posts...');

  // Limpiar servicios viejos para evitar duplicados en cada seed
  await prisma.service.deleteMany({ 
    where: { professionals: { some: { id: proProfile.id } } } 
  });

  // Crear Servicios
  await prisma.service.create({
    data: {
      title: 'Terapia Individual Adultos',
      description: 'Sesión focalizada en procesos de ansiedad y depresión.',
      price: 50.00,
      durationMin: 60, // Ajustado al nombre del campo en tu schema actual (durationMin)
      professionals: { connect: { id: proProfile.id } }
    }
  });

  // Crear Post
  // Verificamos si ya existe el slug para no fallar
  const postSlug = 'entendiendo-la-transferencia';
  const existingPost = await prisma.post.findUnique({ where: { slug: postSlug } });
  
  if (!existingPost) {
    await prisma.post.create({
      data: {
        title: 'Entendiendo la transferencia en la clínica',
        content: 'El concepto de transferencia es fundamental para el proceso terapéutico...',
        slug: postSlug,
        status: 'PUBLISHED',
        authorId: proProfile.id,
        categoryId: catSaludMental.id
      }
    });
  }

  // --------------------------------------------------------
  // 5. DISPONIBILIDAD (Agenda)
  // --------------------------------------------------------
  console.log('📅 Configurando Agenda...');

  // Limpiamos horarios viejos
  await prisma.availability.deleteMany({ where: { professionalId: proProfile.id } });
  
  // Creamos nuevos horarios (Lunes a Viernes, 9-17h)
  const scheduleData = [1, 2, 3, 4, 5].map(day => ({
    professionalId: proProfile.id,
    dayOfWeek: day,
    startTime: '09:00',
    endTime: '17:00'
    // isActive eliminado porque no estaba en el último schema que te di
  }));

  await prisma.availability.createMany({ data: scheduleData });

  console.log('🚀 Seed completado exitosamente.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });