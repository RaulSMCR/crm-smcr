// src/app/api/admin/professionals/[id]/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function asStringArray(x) {
  if (!x) return null;
  if (!Array.isArray(x)) return null;
  return x.map(String).filter(Boolean);
}

export async function GET(_request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acción no permitida" }, { status: 403 });
    }

    const professionalId = params?.id;
    if (!professionalId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const prof = await prisma.professionalProfile.findUnique({
      where: { id: String(professionalId) },
      select: {
        id: true,
        slug: true,
        specialty: true,
        licenseNumber: true,
        bio: true,
        cvUrl: true,
        introVideoUrl: true,
        avatarUrl: true,
        calendarUrl: true,
        paymentLinkBase: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
        services: { select: { id: true, title: true } },
        user: { select: { name: true, email: true, phone: true, emailVerified: true } },
      },
    });

    if (!prof) return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });

    // Adapter compat con tu UI legacy
    const out = {
      id: prof.id,
      name: prof.user?.name || "",
      email: prof.user?.email || "",
      phone: prof.user?.phone || "",
      bio: prof.bio || null,
      avatarUrl: prof.avatarUrl || null,
      resumeUrl: prof.cvUrl || null,
      introVideoUrl: prof.introVideoUrl || null,
      calendarUrl: prof.calendarUrl || null,
      paymentLinkBase: prof.paymentLinkBase || null,
      timeZone: null, // no existe en schema actual
      declaredJobTitle: prof.specialty || "", // legacy
      licenseNumber: prof.licenseNumber || null,
      emailVerified: !!prof.user?.emailVerified,
      isApproved: !!prof.isApproved,
      createdAt: prof.createdAt,
      updatedAt: prof.updatedAt,
      services: prof.services || [],
      categories: [], // legacy (tu UI espera categories)
    };

    return NextResponse.json(out, { status: 200 });
  } catch (e) {
    console.error("ADMIN get professional detail error:", e);
    return NextResponse.json({ error: "Error al cargar profesional" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Acción no permitida" }, { status: 403 });
    }

    const professionalId = params?.id;
    if (!professionalId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const { isApproved } = body;

    // Compat: el UI viejo manda categoryIds; acá lo aceptamos como alias de serviceIds si corresponde
    const serviceIds = asStringArray(body.serviceIds) || asStringArray(body.categoryIds);

    const data = {};
    if (typeof isApproved === "boolean") data.isApproved = isApproved;
    if (serviceIds) {
      data.services = { set: serviceIds.map((id) => ({ id })) };
    }

    const updated = await prisma.professionalProfile.update({
      where: { id: String(professionalId) },
      data,
      select: {
        id: true,
        specialty: true,
        licenseNumber: true,
        bio: true,
        cvUrl: true,
        introVideoUrl: true,
        avatarUrl: true,
        calendarUrl: true,
        paymentLinkBase: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
        services: { select: { id: true, title: true } },
        user: { select: { name: true, email: true, phone: true, emailVerified: true } },
      },
    });

    // devolver en formato compat
    return NextResponse.json(
      {
        id: updated.id,
        name: updated.user?.name || "",
        email: updated.user?.email || "",
        phone: updated.user?.phone || "",
        bio: updated.bio || null,
        avatarUrl: updated.avatarUrl || null,
        resumeUrl: updated.cvUrl || null,
        introVideoUrl: updated.introVideoUrl || null,
        calendarUrl: updated.calendarUrl || null,
        paymentLinkBase: updated.paymentLinkBase || null,
        timeZone: null,
        declaredJobTitle: updated.specialty || "",
        licenseNumber: updated.licenseNumber || null,
        emailVerified: !!updated.user?.emailVerified,
        isApproved: !!updated.isApproved,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        services: updated.services || [],
        categories: [],
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("ADMIN update professional error:", e);
    return NextResponse.json({ error: "Error al actualizar profesional" }, { status: 500 });
  }
}
