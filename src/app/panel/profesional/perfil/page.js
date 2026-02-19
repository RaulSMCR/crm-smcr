// src/app/panel/profesional/perfil/page.js
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import ProfileEditor from "@/components/profile/ProfileEditor";

// Forzar datos frescos para que si el Admin crea un servicio nuevo, aparezca aquí al instante
export const dynamic = "force-dynamic";

/** ✅ Server Action: actualiza SIEMPRE por userId de sesión (nunca por id del form) */
async function updateProfessionalProfile(prevState, formData) {
  "use server";

  try {
    const session = await getSession();
    if (!session || session.role !== "PROFESSIONAL") {
      return { ok: false, error: "Sesión inválida. Vuelve a iniciar sesión." };
    }

    const userId = String(session.sub);

    // Campos básicos
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();

    const specialty = String(formData.get("specialty") || "").trim();
    const bio = String(formData.get("bio") || "").trim();
    const licenseNumber = String(formData.get("licenseNumber") || "").trim();

    // Servicios (soporta name="services" o name="serviceIds")
    const serviceIds = [
      ...formData.getAll("services"),
      ...formData.getAll("serviceIds"),
    ]
      .map((v) => String(v).trim())
      .filter(Boolean);

    // Construimos update del User sin pisar campos con vacío
    const userUpdate = {};
    if (name) userUpdate.name = name;
    if (phone) userUpdate.phone = phone;

    await prisma.professionalProfile.update({
      // ✅ CLAVE: identificador seguro y estable
      where: { userId },

      data: {
        specialty: specialty || undefined,
        bio: bio ? bio : null,
        licenseNumber: licenseNumber ? licenseNumber : null,

        ...(Object.keys(userUpdate).length
          ? { user: { update: userUpdate } }
          : {}),

        // ✅ Setea la lista exacta de servicios seleccionados
        services: {
          set: serviceIds.map((id) => ({ id })),
        },
      },
    });

    // Refrescar vistas
    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/panel/profesional");

    return { ok: true, error: "" };
  } catch (e) {
    console.error("Error updating profile:", e);
    return { ok: false, error: "No se pudo actualizar el perfil. Intenta de nuevo." };
  }
}

export default async function PerfilPage() {
  // 1. Seguridad: Verificar sesión
  const session = await getSession();

  if (!session || session.role !== "PROFESSIONAL") {
    redirect("/ingresar");
  }

  // 2. Cargar Datos del Profesional (Incluyendo User y Servicios actuales)
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: session.sub }, // Usamos session.sub (ID Usuario) que es más seguro
    include: {
      services: true, // Trae los servicios que YA tiene marcados
      user: {
        select: {
          name: true,
          email: true,
          image: true,
          phone: true,
        },
      },
    },
  });

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-xl shadow border border-red-100">
          <h2 className="text-red-600 font-bold mb-2">Error de Perfil</h2>
          <p className="text-slate-600">No se encontró el perfil asociado. Contacta a soporte.</p>
        </div>
      </div>
    );
  }

  // 3. Cargar TODOS los servicios disponibles en el sistema (Activos)
  const allServices = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="bg-slate-50 py-10 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Encabezado Simple */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Mi Perfil Profesional</h1>
          <p className="text-slate-500 mt-2">
            Actualiza tu foto, biografía y selecciona los servicios que ofreces para que los pacientes te encuentren.
          </p>
        </div>

        {/* ✅ Pasamos la Server Action al editor */}
        <ProfileEditor
          profile={profile}
          allServices={allServices}
          updateAction={updateProfessionalProfile}
        />
      </div>
    </div>
  );
}
