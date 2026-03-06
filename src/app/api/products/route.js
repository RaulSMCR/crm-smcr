// src/app/api/products/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function GET(request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const q            = String(searchParams.get("q") || "").trim();
    const activeOnly   = searchParams.get("active") !== "false";
    const canBeSold    = searchParams.get("canBeSold");
    const canBePurchased = searchParams.get("canBePurchased");

    const where = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(canBeSold === "true" ? { canBeSold: true } : {}),
      ...(canBePurchased === "true" ? { canBePurchased: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { internalReference: { contains: q, mode: "insensitive" } },
              { cabysCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        saleTax:     { select: { id: true, name: true, rate: true, label: true } },
        purchaseTax: { select: { id: true, name: true, rate: true, label: true } },
      },
    });

    return NextResponse.json({ items: products.map(mapProduct), total: products.length });
  } catch (error) {
    console.error("[products] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ message: "name es requerido." }, { status: 400 });

    const product = await prisma.product.create({
      data: {
        name,
        description:       body.description       ? String(body.description)       : null,
        internalReference: body.internalReference ? String(body.internalReference) : null,
        productType:       body.productType === "consumable" ? "consumable" : "service",
        cabysCode:         body.cabysCode         ? String(body.cabysCode)         : null,
        category:          body.category          ? String(body.category)          : "All",
        salePrice:         Number(body.salePrice  || 0),
        costPrice:         Number(body.costPrice  || 0),
        saleTaxId:         body.saleTaxId         ? String(body.saleTaxId)         : null,
        purchaseTaxId:     body.purchaseTaxId     ? String(body.purchaseTaxId)     : null,
        saleUom:           body.saleUom           ? String(body.saleUom)           : "Unidad(es)",
        purchaseUom:       body.purchaseUom       ? String(body.purchaseUom)       : "Unidad(es)",
        incomeAccount:     body.incomeAccount     ? String(body.incomeAccount)     : null,
        expenseAccount:    body.expenseAccount    ? String(body.expenseAccount)    : null,
        canBeSold:         body.canBeSold    !== false,
        canBePurchased:    body.canBePurchased !== false,
      },
      include: {
        saleTax:     { select: { id: true, name: true, rate: true, label: true } },
        purchaseTax: { select: { id: true, name: true, rate: true, label: true } },
      },
    });

    return NextResponse.json(mapProduct(product), { status: 201 });
  } catch (error) {
    console.error("[products] POST error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
