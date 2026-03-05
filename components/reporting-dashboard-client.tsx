"use client";

import { useState } from "react";
import type {
  MetricKey,
  ReportingResult,
  OrganizationSummary,
} from "@/lib/reporting";
import { cn } from "@/lib/utils";

const METRIC_LABELS: Record<MetricKey, string> = {
  meta_spend: "Meta Spend",
  meta_impressions: "Meta Impressions",
  google_spend: "Google Spend",
  google_impressions: "Google Impressions",
  revenue: "Revenue",
  orders: "Orders",
  fees: "Fees",
  meta_cpm: "Meta CPM",
  google_cpm: "Google CPM",
  average_order_value: "Average Order Value",
  total_spend: "Total Spend",
  profit: "Profit",
  roas: "ROAS",
};

type Props = {
  organizations: OrganizationSummary[];
  initialOrgId: number;
  initialStartDate: string;
  initialEndDate: string;
  initialMetrics: MetricKey[];
  initialData: ReportingResult;
};

export function ReportingDashboardClient({
  organizations,
  initialOrgId,
  initialStartDate,
  initialEndDate,
  initialMetrics,
  initialData,
}: Props) {
  const [orgId, setOrgId] = useState(initialOrgId);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [metrics, setMetrics] = useState<MetricKey[]>(initialMetrics);
  const [data, setData] = useState<ReportingResult>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMetricToggle = (metric: MetricKey) => {
    setMetrics((current) =>
      current.includes(metric)
        ? current.filter((m) => m !== metric)
        : [...current, metric],
    );
  };

  const handleApplyFilters = async () => {
    if (!startDate || !endDate || metrics.length === 0) {
      setError(
        "Seleccioná fecha de inicio, fecha de fin y al menos una métrica.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        orgId: String(orgId),
        startDate,
        endDate,
        metrics: metrics.join(","),
      });

      const response = await fetch(`/api/reporting?${params.toString()}`);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          body?.error ?? `Error al consultar el reporting (${response.status})`,
        );
      }

      const json = (await response.json()) as ReportingResult;
      setData(json);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error inesperado al cargar datos";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const activeMetrics = metrics;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Filtros</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Fecha inicio
            </label>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Fecha fin
            </label>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Organización
            </label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={orgId}
              onChange={(e) => setOrgId(Number(e.target.value))}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Seleccioná la organización a analizar.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Métricas</span>
            <button
              type="button"
              className="text-xs text-blue-500 hover:underline"
              onClick={() => setMetrics(initialMetrics)}
            >
              Restablecer selección
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              Object.keys(METRIC_LABELS) as MetricKey[]
            ).map((metric) => (
              <button
                key={metric}
                type="button"
                onClick={() => handleMetricToggle(metric)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  activeMetrics.includes(metric)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground hover:bg-muted",
                )}
              >
                {METRIC_LABELS[metric]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleApplyFilters}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Cargando..." : "Aplicar filtros"}
          </button>
          {error && (
            <p className="text-sm text-red-500">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Totales</h2>
        {activeMetrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Seleccioná al menos una métrica para ver totales.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {activeMetrics.map((metric) => {
              const value = data.totals[metric];
              return (
                <div
                  key={metric}
                  className="rounded-lg border bg-card p-4 shadow-sm"
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {METRIC_LABELS[metric]}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatMetricValue(metric, value)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Desglose diario</h2>
        {data.daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay datos para el rango seleccionado.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  {activeMetrics.map((metric) => (
                    <th
                      key={metric}
                      className="px-3 py-2 text-left font-medium"
                    >
                      {METRIC_LABELS[metric]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.daily.map((row) => (
                  <tr
                    key={row.date}
                    className="border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      {row.date}
                    </td>
                    {activeMetrics.map((metric) => (
                      <td key={metric} className="px-3 py-2 align-top">
                        {formatMetricValue(metric, row[metric] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatMetricValue(metric: MetricKey, value: number | null | undefined) {
  if (value == null) return "–";

  const currencyMetrics: MetricKey[] = [
    "meta_spend",
    "google_spend",
    "revenue",
    "fees",
    "total_spend",
    "profit",
    "average_order_value",
  ];

  const ratioMetrics: MetricKey[] = ["roas"];

  if (currencyMetrics.includes(metric)) {
    return `$${value.toFixed(2)}`;
  }

  if (ratioMetrics.includes(metric)) {
    return value.toFixed(2);
  }

  if (metric.endsWith("impressions") || metric === "orders") {
    return Math.round(value).toLocaleString();
  }

  return value.toFixed(2);
}

