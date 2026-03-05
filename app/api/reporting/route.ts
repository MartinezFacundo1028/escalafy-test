import { NextRequest, NextResponse } from "next/server";
import { getReportingData, type MetricKey } from "@/lib/reporting";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const orgIdParam = searchParams.get("orgId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const metricsParam = searchParams.get("metrics");

  if (!orgIdParam || !startDate || !endDate || !metricsParam) {
    return NextResponse.json(
      {
        error:
          "Parámetros requeridos: orgId, startDate, endDate, metrics (lista separada por comas)",
      },
      { status: 400 },
    );
  }

  const orgId = Number.parseInt(orgIdParam, 10);
  if (!Number.isFinite(orgId)) {
    return NextResponse.json(
      { error: "orgId debe ser un número entero" },
      { status: 400 },
    );
  }

  const metrics = metricsParam
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean) as MetricKey[];

  if (metrics.length === 0) {
    return NextResponse.json(
      { error: "Debe solicitarse al menos una métrica en metrics" },
      { status: 400 },
    );
  }

  try {
    const data = await getReportingData({
      orgId,
      startDate,
      endDate,
      metrics,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error inesperado en reporting";

    const isClientError =
      message.startsWith("Métricas inválidas") ||
      message.includes("no encontrada") ||
      message.includes("Debe solicitarse al menos una métrica");

    return NextResponse.json(
      { error: message },
      { status: isClientError ? 400 : 500 },
    );
  }
}

