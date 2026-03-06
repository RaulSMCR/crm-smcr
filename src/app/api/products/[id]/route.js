// src/app/api/products/[id]/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: "No autorizado." }, { status: 401 }) };
  if (session.role !== "ADMIN") return { error: NextResponse.json({ message: "Acción no permitida." }, { status: 403 }) };
  return { session };
}

function mapProduct(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    internalReference: p.internalReference,
    productType: p.productType,
    cabysCode: p.cabysCode,
    category: p.category,
    salePrice: Number(p.salePrice),
    costPrice: Number(p.costPrice),
    saleTaxId: p.saleTaxId,
    purchaseTaxId: p.purchaseTaxId,
    saleUom: p.saleUom,
    purchaseUom: p.purchaseUom,
    incomeAccount: p.incomeAccount,
    expenseAccount: p.expenseAccount,
    canBeSold: p.canBeSold,
    canBePurchased: p.canBePurchased,
    isActive: p.isActive,
    saleTax: p.saleTax || null,
    purchaseTax: p.purchaseTax || null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function GET(_request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        saleTax:     { select: { id: true, name: true, rate: true, label: true } },
        purchaseTax: { select: { id: true, name: true, rate: true, label: true } },
      },
    });

    if (!product) return NextResponse.json({ message: "Producto no encontrado." }, { status: 404 });

    return NextResponse.json(mapProduct(product));
  } catch (error) {
    console.error("[products/:id] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const id = String(params?.id || "");
    if (!id) return NextResponse.json({ message: "id inválido." }, { status: 400 });

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: "Producto no encontrado." }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data = {};

    if (body.name             !== undefined) data.name             = String(body.name).trim() || existing.name;
    if (body.description      !== undefined) data.description      = body.description      ? String(body.description)      : null;
    if (body.internalReference !== undefined) data.internalReference = body.internalReference ? String(body.internalReference) : null;
    if (body.productType      !== undefined) data.productType      = body.productType === "consumable" ? "consumable" : "service";
    if (body.cabysCode        !== undefined) data.cabysCode        = body.cabysCode        ? String(body.cabysCode)        : null;
    if (body.category         !== undefined) data.category         = body.category         ? String(body.category)         : "All";
    if (body.salePrice        !== undefined) data.salePrice        = Number(body.salePrice  || 0);
    if (body.costPrice        !== undefined) data.costPrice        = Number(body.costPrice  || 0);
    if (body.saleTaxId        !== undefined) data.saleTaxId        = body.saleTaxId        ? String(body.saleTaxId)        : null;
    if (body.purchaseTaxId    !== undefined) data.purchaseTaxId    = body.purchaseTaxId    ? String(body.purchaseTaxId)    : null;
    if (body.saleUom          !== undefined) data.saleUom          = body.saleUom          ? String(body.saleUom)          : "Unidad(es)";
    if (body.purchaseUom      !== undefined) data.purchaseUom      = body.purchaseUom      ? String(body.purchaseUom)      : "Unidad(es)";
    if (body.incomeAccount    !== undefined) data.incomeAccount    = body.incomeAccount    ? String(body.incomeAccount)    : null;
    if (body.expenseAccount   !== undefined) data.expenseAccount   = body.expenseAccount   ? String(body.expenseAccount)   : null;
    if (body.canBeSold        !== undefined) data.canBeSold        = body.canBeSold    !== false;
    if (body.canBePurchased   !== undefined) data.canBePurchased   = body.canBePurchased !== false;
    if (body.isActive         !== undefined) data.isActive         = body.isActive     !== false;

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        saleTax:     { select: { id: true, name: true, rate: true, label: true } },
        purchaseTax: { select: { id: true, name: true, rate: true, label: true } },
      },
    });

    return NextResponse.json(mapProduct(updated));
  } catch (error) {
    console.error("[products/:id] PUT error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
