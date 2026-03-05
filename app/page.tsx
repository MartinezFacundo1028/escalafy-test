import { ReportingDashboardClient } from "@/components/reporting-dashboard-client";
import type { MetricKey } from "@/lib/reporting";
import { getReportingData, listOrganizations } from "@/lib/reporting";

const DEFAULT_METRICS: MetricKey[] = [
  "revenue",
  "total_spend",
  "profit",
  "roas",
];

function formatDateIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function Home() {
  const organizations = await listOrganizations();
  const initialOrgId = organizations[0]?.id ?? 1;

  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 6); // últimos 7 días, incluyendo hoy

  const startDate = formatDateIso(start);
  const endDate = formatDateIso(today);

  const initialData = await getReportingData({
    orgId: initialOrgId,
    startDate,
    endDate,
    metrics: DEFAULT_METRICS,
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Reporting Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Explorá el rendimiento de campañas y tienda combinando datos de Meta, Google y tu store.
          </p>
        </header>

        <ReportingDashboardClient
          organizations={organizations}
          initialOrgId={initialOrgId}
          initialStartDate={startDate}
          initialEndDate={endDate}
          initialMetrics={DEFAULT_METRICS}
          initialData={initialData}
        />
      </div>
    </main>
  );
}

