import { query } from "./db";

export type MetricKey =
  | "meta_spend"
  | "meta_impressions"
  | "google_spend"
  | "google_impressions"
  | "revenue"
  | "orders"
  | "fees"
  | "meta_cpm"
  | "google_cpm"
  | "average_order_value"
  | "total_spend"
  | "profit"
  | "roas";

export const ALL_METRICS: MetricKey[] = [
  "meta_spend",
  "meta_impressions",
  "google_spend",
  "google_impressions",
  "revenue",
  "orders",
  "fees",
  "meta_cpm",
  "google_cpm",
  "average_order_value",
  "total_spend",
  "profit",
  "roas",
];

export type ReportingParams = {
  orgId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  metrics: MetricKey[];
};

export type ReportingTotals = Partial<Record<MetricKey, number>>;

export type ReportingDailyRow = {
  date: string;
} & Partial<Record<MetricKey, number | null>>;

export type ReportingResult = {
  totals: ReportingTotals;
  daily: ReportingDailyRow[];
};

type OrganizationRow = {
  id: number;
  meta_account_id: string;
  google_account_id: string;
  store_id: string;
};

export type OrganizationSummary = {
  id: number;
  name: string;
};

export async function listOrganizations(): Promise<OrganizationSummary[]> {
  const result = await query<OrganizationSummary>(
    `
      SELECT id, name
      FROM organization
      ORDER BY id
    `,
  );

  return result.rows;
}

type MetaAggRow = {
  date: string;
  meta_spend: number;
  meta_impressions: number;
};

type GoogleAggRow = {
  date: string;
  google_spend: number;
  google_impressions: number;
};

type StoreAggRow = {
  date: string;
  revenue: number;
  orders: number;
  fees: number;
};

type RawDaily = {
  date: string;
  meta_spend: number;
  meta_impressions: number;
  google_spend: number;
  google_impressions: number;
  revenue: number;
  orders: number;
  fees: number;
};

export async function getReportingData(
  params: ReportingParams,
): Promise<ReportingResult> {
  const { orgId } = params;
  let { startDate, endDate, metrics } = params;

  if (!metrics.length) {
    throw new Error("Debe solicitarse al menos una métrica");
  }

  // Normalizar métricas: quitar duplicados y validar
  const uniqueMetrics = Array.from(new Set(metrics));
  const invalid = uniqueMetrics.filter(
    (m) => !ALL_METRICS.includes(m as MetricKey),
  );
  if (invalid.length > 0) {
    throw new Error(`Métricas inválidas: ${invalid.join(", ")}`);
  }
  metrics = uniqueMetrics as MetricKey[];

  // Asegurarnos de que startDate <= endDate (si no, las invertimos)
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  // 1) Resolver organización y IDs de cuentas
  const orgResult = await query<OrganizationRow>(
    `
      SELECT id, meta_account_id, google_account_id, store_id
      FROM organization
      WHERE id = $1
    `,
    [orgId],
  );

  if (orgResult.rowCount === 0) {
    throw new Error(`Organización con id=${orgId} no encontrada`);
  }

  const org = orgResult.rows[0];

  // 2) Traer datos agregados por fecha de cada fuente

  const [metaResult, googleResult, storeResult] = await Promise.all([
    query<MetaAggRow>(
      `
        SELECT
          date::text AS date,
          SUM(spend)::float8 AS meta_spend,
          SUM(impressions)::int AS meta_impressions
        FROM meta_ads_data
        WHERE account_id = $1
          AND date BETWEEN $2::date AND $3::date
        GROUP BY date
        ORDER BY date
      `,
      [org.meta_account_id, startDate, endDate],
    ),
    query<GoogleAggRow>(
      `
        SELECT
          date::text AS date,
          SUM(spend)::float8 AS google_spend,
          SUM(impressions)::int AS google_impressions
        FROM google_ads_data
        WHERE account_id = $1
          AND date BETWEEN $2::date AND $3::date
        GROUP BY date
        ORDER BY date
      `,
      [org.google_account_id, startDate, endDate],
    ),
    query<StoreAggRow>(
      `
        SELECT
          date::text AS date,
          SUM(revenue)::float8 AS revenue,
          SUM(orders)::int AS orders,
          SUM(fees)::float8 AS fees
        FROM store_data
        WHERE store_id = $1
          AND date BETWEEN $2::date AND $3::date
        GROUP BY date
        ORDER BY date
      `,
      [org.store_id, startDate, endDate],
    ),
  ]);

  // 3) Fusionar resultados por fecha en un mapa
  const byDate = new Map<string, RawDaily>();

  const ensureDay = (date: string): RawDaily => {
    let existing = byDate.get(date);
    if (!existing) {
      existing = {
        date,
        meta_spend: 0,
        meta_impressions: 0,
        google_spend: 0,
        google_impressions: 0,
        revenue: 0,
        orders: 0,
        fees: 0,
      };
      byDate.set(date, existing);
    }
    return existing;
  };

  for (const row of metaResult.rows) {
    const day = ensureDay(row.date);
    day.meta_spend += row.meta_spend ?? 0;
    day.meta_impressions += row.meta_impressions ?? 0;
  }

  for (const row of googleResult.rows) {
    const day = ensureDay(row.date);
    day.google_spend += row.google_spend ?? 0;
    day.google_impressions += row.google_impressions ?? 0;
  }

  for (const row of storeResult.rows) {
    const day = ensureDay(row.date);
    day.revenue += row.revenue ?? 0;
    day.orders += row.orders ?? 0;
    day.fees += row.fees ?? 0;
  }

  const rawDaily = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // 4) Calcular métricas solicitadas por día
  const daily: ReportingDailyRow[] = rawDaily.map((day) =>
    computeMetricsForDay(day, metrics),
  );

  // 5) Calcular totales sumando las métricas solicitadas
  const totals: ReportingTotals = {};

  for (const row of daily) {
    for (const metric of metrics) {
      const value = row[metric];
      if (value == null) continue;
      totals[metric] = (totals[metric] ?? 0) + value;
    }
  }

  return { totals, daily };
}

function computeMetricsForDay(
  day: RawDaily,
  metrics: MetricKey[],
): ReportingDailyRow {
  const result: ReportingDailyRow = { date: day.date };

  const metaSpend = day.meta_spend ?? 0;
  const metaImpressions = day.meta_impressions ?? 0;
  const googleSpend = day.google_spend ?? 0;
  const googleImpressions = day.google_impressions ?? 0;
  const revenue = day.revenue ?? 0;
  const orders = day.orders ?? 0;
  const fees = day.fees ?? 0;

  const totalSpend = metaSpend + googleSpend;

  for (const metric of metrics) {
    switch (metric) {
      case "meta_spend":
        result.meta_spend = metaSpend;
        break;
      case "meta_impressions":
        result.meta_impressions = metaImpressions;
        break;
      case "google_spend":
        result.google_spend = googleSpend;
        break;
      case "google_impressions":
        result.google_impressions = googleImpressions;
        break;
      case "revenue":
        result.revenue = revenue;
        break;
      case "orders":
        result.orders = orders;
        break;
      case "fees":
        result.fees = fees;
        break;
      case "meta_cpm":
        result.meta_cpm =
          metaImpressions > 0 ? (metaSpend / metaImpressions) * 1000 : null;
        break;
      case "google_cpm":
        result.google_cpm =
          googleImpressions > 0
            ? (googleSpend / googleImpressions) * 1000
            : null;
        break;
      case "average_order_value":
        result.average_order_value =
          orders > 0 ? revenue / orders : null;
        break;
      case "total_spend":
        result.total_spend = totalSpend;
        break;
      case "profit":
        result.profit = revenue - metaSpend - googleSpend - fees;
        break;
      case "roas":
        result.roas = totalSpend > 0 ? revenue / totalSpend : null;
        break;
    }
  }

  return result;
}

