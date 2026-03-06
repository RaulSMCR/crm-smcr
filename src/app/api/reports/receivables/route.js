// src/app/api/reports/receivables/route.js
// CXC — Cuentas por Cobrar: facturas de cliente con saldo pendiente.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "No autorizado." }, { status: 401 });
    if (session.role !== "ADMIN") return NextResponse.json({ message: "Acción no permitida." }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const dateFrom  = searchParams.get("dateFrom");
    const dateTo    = searchParams.get("dateTo");
    const contactId = String(searchParams.get("contactId") || "").trim();

    const now = new Date();

    const where = {
      invoiceType: "CUSTOMER_INVOICE",
      status: "OPEN",
      balance: { gt: 0 },
      ...(contactId ? { contactId } : {}),
      ...(dateFrom || dateTo
        ? {
            dueDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
            },
          }
        : {}),
    };

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: [{ contactName: "asc" }, { dueDate: "asc" }],
      select: {
        id: true, invoiceNumber: true, feStatus: true,
        contactId: true, contactName: true, contactIdNumber: true,
        invoiceDate: true, dueDate: true,
        total: true, amountPaid: true, balance: true,
      },
    });

    // Agrupar por contacto
    const byContact = new Map();
    let grandTotal   = 0;
    let grandBalance = 0;
    let overdueBalance = 0;

    for (const inv of invoices) {
      if (!byContact.has(inv.contactId)) {
        byContact.set(inv.contactId, {
          contactId: inv.contactId,
          contactName: inv.contactName,
          contactIdNumber: inv.contactIdNumber,
          invoicesCount: 0,
          total: 0, amountPaid: 0, balance: 0,
          overdueBalance: 0,
          invoices: [],
        });
      }
      const g       = byContact.get(inv.contactId);
      const balance = Number(inv.balance);
      const total   = Number(inv.total);
      const isOverdue = inv.dueDate < now;

      g.invoicesCount++;
      g.total      += total;
      g.amountPaid += Number(inv.amountPaid);
      g.balance    += balance;
      if (isOverdue) g.overdueBalance += balance;

      g.invoices.push({
        id: inv.id, invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate, dueDate: inv.dueDate,
        total, amountPaid: Number(inv.amountPaid), balance,
        feStatus: inv.feStatus, isOverdue,
        daysOverdue: isOverdue ? Math.floor((now - inv.dueDate) / 86400000) : 0,
      });

      grandTotal    += total;
      grandBalance  += balance;
      if (isOverdue) overdueBalance += balance;
    }

    return NextResponse.json({
      filters: { dateFrom: dateFrom || null, dateTo: dateTo || null, contactId: contactId || null },
      summary: {
        contactsCount:  byContact.size,
        invoicesCount:  invoices.length,
        grandTotal,
        grandBalance,
        overdueBalance,
        currentBalance: grandBalance - overdueBalance,
      },
      groups: Array.from(byContact.values()),
    });
  } catch (error) {
    console.error("[reports/receivables] GET error:", error);
    return NextResponse.json({ message: "Error interno del servidor." }, { status: 500 });
  }
}
