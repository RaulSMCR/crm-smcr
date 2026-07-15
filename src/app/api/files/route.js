import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fileApiUrl, getSignedUrl, parseStorageReference } from "@/lib/storage";

const PRIVATE_BUCKETS = new Set([
  "insurance-blank-forms",
  "insurance-patient-forms",
  "insurance-templates",
  "insurance-signed-forms",
  "CVS",
  "professional-invoices",
]);

function userId(session) { return String(session?.userId || session?.sub || ""); }

async function canRead(session, ref) {
  if (session.role === "ADMIN") return true;
  if (!PRIVATE_BUCKETS.has(ref.bucket)) return false;
  const uid = userId(session);
  const professionalId = String(session.professionalProfileId || "");

  if (ref.bucket === "insurance-blank-forms" || ref.bucket === "insurance-patient-forms") {
    return session.role === "USER" && ref.path.startsWith(`${uid}/`);
  }
  if (ref.bucket === "professional-invoices") {
    return session.role === "PROFESSIONAL" && ref.path.startsWith(`${professionalId}/`);
  }
  if (ref.bucket === "CVS") {
    return session.role === "PROFESSIONAL" && ref.path.startsWith(`${uid}/`);
  }
  if (ref.bucket === "insurance-signed-forms") {
    const claim = await prisma.insuranceClaim.findUnique({ where: { id: ref.path.split("/")[0] }, select: { patientId: true, professionalId: true } });
    return Boolean(claim && ((session.role === "USER" && claim.patientId === uid) || (session.role === "PROFESSIONAL" && claim.professionalId === professionalId)));
  }
  if (ref.bucket === "insurance-templates") {
    const patientId = ref.path.split("/")[0];
    if (session.role === "USER" && patientId === uid) return true;
    if (session.role !== "PROFESSIONAL") return false;
    const relation = await prisma.appointment.findFirst({ where: { patientId, professionalId }, select: { id: true } });
    return Boolean(relation);
  }
  return false;
}

export async function GET(request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const ref = parseStorageReference(new URL(request.url).searchParams.get("path"));
  if (!ref || !PRIVATE_BUCKETS.has(ref.bucket) || !(await canRead(session, ref))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  try {
    const url = await getSignedUrl(ref.bucket, ref.path);
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("[files] Error creando URL firmada:", error);
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }
}

export { fileApiUrl };
