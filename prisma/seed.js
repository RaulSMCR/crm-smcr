const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando siembra de datos (Seeding)...');

  // Contraseña común encriptada para todos
  const hashedPassword = await bcrypt.hash('Password123!', 12);

  // 1. ADMIN
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

  // 2. PROFESIONAL (Dr. Test)
  const pro = await prisma.professional.upsert({
    where: { email: 'pro@test.com' },
    update: { 
      isApproved: true, 
      emailVerified: true 
    },
    create: {
      email: 'pro@test.com',
      name: 'Dr. Test House',
      profession: 'Psicólogo Clínico',
      phone: '555-0001',
      passwordHash: hashedPassword,
      isApproved: true,       // YA APROBADO
      emailVerified: true,    // YA VERIFICADO
      introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      bio: 'Profesional de prueba generado automáticamente para testing.',
    },
  });
  console.log('✅ Profesional creado: pro@test.com');
  console.log('🔑 ID DEL PROFESIONAL (Copia esto para test-booking):', pro.id);

  // 3. HORARIOS DEL PROFESIONAL (Availability)
  // Limpiamos horarios viejos para no duplicar si corres el seed varias veces
  await prisma.availability.deleteMany({ where: { professionalId: pro.id } });
  
  // Creamos disponibilidad de Lunes (1) a Viernes (5) de 09:00 a 17:00
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

  // 4. PACIENTE (Usuario de Prueba)
  const user = await prisma.user.upsert({
    where: { email: 'paciente@test.com' },
    update: { emailVerified: true },
    create: {
      email: 'paciente@test.com',
      name: 'Paciente De Prueba',
      passwordHash: hashedPassword,
      role: 'USER',
      emailVerified: true, // YA VERIFICADO
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