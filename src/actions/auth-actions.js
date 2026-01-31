//src/actions/auth-actions.js
export async function registerProfessional(formData) {
  // 1. Recibir todos los datos del formulario rico
  const name = formData.get('name');
  const email = formData.get('email');
  const password = formData.get('password');
  const specialty = formData.get('specialty');
  const phone = formData.get('phone'); // <--- NUEVO
  const bio = formData.get('bio');     // <--- NUEVO

  if (!name || !email || !password || !specialty) {
    return { error: "Los campos Nombre, Email, Contraseña y Especialidad son obligatorios." };
  }

  try {
    const existingUser = await prisma.professional.findUnique({ where: { email } });
    if (existingUser) return { error: "Este correo ya está registrado." };

    // Generar Slug (obligatorio en tu nueva DB)
    let slug = name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
    let count = 0;
    while (await prisma.professional.findUnique({ where: { slug: count === 0 ? slug : `${slug}-${count}` } })) {
      count++;
    }
    const finalSlug = count === 0 ? slug : `${slug}-${count}`;

    const hashedPassword = await bcrypt.hash(password, 10);

    // Guardar en Base de Datos incluyendo los campos extra
    await prisma.professional.create({
      data: {
        name,
        email,
        password: hashedPassword,
        specialty,
        slug: finalSlug,
        phone: phone || null, // Guardamos teléfono si existe
        bio: bio || null,     // Guardamos bio si existe
        // Si tienes introVideoUrl en tu schema, descomenta la siguiente línea:
        // introVideoUrl: formData.get('introVideoUrl') || null,
      }
    });

    return { success: true };
  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error interno al registrar." };
  }
}