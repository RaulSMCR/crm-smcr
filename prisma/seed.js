const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando siembra de datos (Seeding)...');

  // Contraseña común encriptada para todos
  const hashedPassword = await bcrypt.hash('Password123!', 12);

  // --------------------------------------------------------
  // 1. ADMIN
  // --------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm-smcr.com' },
    update: {},
    create: {
      email: 'admin@crm-smcr.com',
      name: 'Super Admin',
      passwordHash: hashedPassword,
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  console.log('✅ Admin creado: admin@crm-smcr.com');

  // --------------------------------------------------------
  // 2. CATEGORÍAS (Lógica de Árbol)
  // --------------------------------------------------------
  console.log('📂 Creando estructura de categorías...');

  // Definición del árbol en Array de JS
  const taxonomy = [
    {
      name: 'Medicina y Especialidades', slug: 'medicina', icon: 'stethoscope',
      children: [
        { name: 'Médico Clínico', slug: 'medico-clinico' },
        { name: 'Pediatría', slug: 'pediatria' },
        { name: 'Cardiología', slug: 'cardiologia' },
        { name: 'Ginecología', slug: 'ginecologia' },
      ]
    },
    {
      name: 'Salud Mental', slug: 'salud-mental', icon: 'brain',
      children: [
        { name: 'Psicología', slug: 'psicologia' },
        { name: 'Psiquiatría', slug: 'psiquiatria' },
        { name: 'Musicoterapia', slug: 'musicoterapia' },
      ]
    },
    {
      name: 'Rehabilitación', slug: 'rehabilitacion', icon: 'walker',
      children: [
        { name: 'Kinesiología / Fisioterapia', slug: 'kinesiologia' },
        { name: 'Terapia del Lenguaje', slug: 'fonoaudiologia' },
        { name: 'Terapia Ocupacional', slug: 'terapia-ocupacional' },
      ]
    },
    {
      name: 'Cuidados y Enfermería', slug: 'cuidados', icon: 'heart-pulse',
      children: [
        { name: 'Enfermería', slug: 'enfermeria' },
        { name: 'Cuidador Domiciliario', slug: 'cuidador' },
        { name: 'Acompañante Terapéutico', slug: 'acompanante-terapeutico' },
      ]
    },
    {
      name: 'Bienestar y Desarrollo', slug: 'bienestar', icon: 'sun',
      children: [
        { name: 'Coaching', slug: 'coaching' },
        { name: 'Preparador Físico', slug: 'preparador-fisico' },
        { name: 'Nutrición', slug: 'nutricion' },
      ]
    },
    {
      name: 'Asesoría Legal en Salud', slug: 'legales-salud', icon: 'scale',
      children: [
        { name: 'Abogado (Derecho de Salud)', slug: 'abogado-salud' },
        { name: 'Gestoría', slug: 'gestoria' },
      ]
    }
  ];

  // Recorremos el array para insertar en DB
  for (const group of taxonomy) {
    // 1. Crear o Actualizar Padre
    const parent = await prisma.category.upsert({
      where: { slug: group.slug },
      update: {},
      create: {
        name: group.name,
        slug: group.slug,
        icon: group.icon
      }
    });

    // 2. Crear o Actualizar Hijos vinculados al Padre
    for (const child of group.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: { parentId: parent.id },
        create: {
          name: child.name,
          slug: child.slug,
          parentId: parent.id
        }
      });
    }
  }
  console.log('✅ Categorías sembradas.');

  // --------------------------------------------------------
  // 3. PROFESIONAL (Dr. Test)
  // --------------------------------------------------------
  
  // Buscamos los IDs de las categorías para asignar
  const catSaludMental = await prisma.category.findUnique({ where: { slug: 'salud-mental' }});
  const catPsicologia = await prisma.category.findUnique({ where: { slug: 'psicologia' }});

  const pro = await prisma.professional.upsert({
    where: { email: 'pro@test.com' },
    update: { 
      isApproved: true, 
      emailVerified: true,
      // Reconectamos categorías en caso de update
      categories: {
        connect: [
            { id: catSaludMental.id },
            { id: catPsicologia.id }
        ]
      }
    },
    create: {
      email: 'pro@test.com',
      name: 'Dr. Test House',
      declaredJobTitle: 'Psicólogo Clínico', // <--- CAMBIO: Usamos declaredJobTitle
      phone: '555-0001',
      passwordHash: hashedPassword,
      isApproved: true,
      emailVerified: true,
      introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      bio: 'Profesional de prueba generado para testing.',
      
      // Conexión N:M con categorías
      categories: {
        connect: [
            { id: catSaludMental.id },
            { id: catPsicologia.id }
        ]
      }
    },
  });
  console.log('✅ Profesional creado: pro@test.com');
  console.log('🔑 ID DEL PROFESIONAL:', pro.id);

  // --------------------------------------------------------
  // 4. HORARIOS
  // --------------------------------------------------------
  await prisma.availability.deleteMany({ where: { professionalId: pro.id } });
  
  const dias = [1, 2, 3, 4, 5]; 
  const horariosData = dias.map(day => ({
    professionalId: pro.id,
    dayOfWeek: day,
    startTime: '09:00',
    endTime: '17:00',
    isActive: true
  }));

  await prisma.availability.createMany({ data: horariosData });
  console.log('✅ Horarios asignados (Lun-Vie 9-17hs)');

  // --------------------------------------------------------
  // 5. PACIENTE
  // --------------------------------------------------------
  const user = await prisma.user.upsert({
    where: { email: 'paciente@test.com' },
    update: { emailVerified: true },
    create: {
      email: 'paciente@test.com',
      name: 'Paciente De Prueba',
      passwordHash: hashedPassword,
      role: 'USER',
      emailVerified: true,
      identification: '111222333',
      birthDate: new Date('1990-01-01'),
      phone: '999-8888',
    },
  });
  console.log('✅ Paciente creado: paciente@test.com');

  console.log('🚀 Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });