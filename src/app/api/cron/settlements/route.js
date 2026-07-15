import { NextResponse } from "next/server";
import { generateSettlementPeriod } from "@/actions/settlement-actions";
import { previousClosedSettlementPeriod } from "@/lib/settlement-period";

export const dynamic = "force-dynamic";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const period = previousClosedSettlementPeriod();
    const result = await generateSettlementPeriod(period);
    return NextResponse.json({ ...result, ...period });
  } catch (error) {
    console.error("[cron/settlements] Error:", error);
    return NextResponse.json({ error: "No se pudo cerrar el período." }, { status: 500 });
  }
}
