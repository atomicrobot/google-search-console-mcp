function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysAgo(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ComparisonPeriods {
  current: DateRange;
  previous: DateRange;
}

/** Last 28 days (yesterday minus 27 days to yesterday). */
export function getDefaultDateRange(): DateRange {
  const yesterday = daysAgo(1);
  const start = daysAgo(28);
  return { startDate: formatDate(start), endDate: formatDate(yesterday) };
}

/** Last 90 days (yesterday minus 89 days to yesterday). */
export function getExtendedDateRange(): DateRange {
  const yesterday = daysAgo(1);
  const start = daysAgo(90);
  return { startDate: formatDate(start), endDate: formatDate(yesterday) };
}

/** Week-over-week: current 7 days vs previous 7 days. */
export function getWowPeriods(): ComparisonPeriods {
  const yesterday = daysAgo(1);
  const currentStart = daysAgo(7);
  const previousEnd = daysAgo(8);
  const previousStart = daysAgo(14);
  return {
    current: { startDate: formatDate(currentStart), endDate: formatDate(yesterday) },
    previous: { startDate: formatDate(previousStart), endDate: formatDate(previousEnd) },
  };
}

/** Month-over-month: current 28 days vs previous 28 days. */
export function getMomPeriods(): ComparisonPeriods {
  const yesterday = daysAgo(1);
  const currentStart = daysAgo(28);
  const previousEnd = daysAgo(29);
  const previousStart = daysAgo(56);
  return {
    current: { startDate: formatDate(currentStart), endDate: formatDate(yesterday) },
    previous: { startDate: formatDate(previousStart), endDate: formatDate(previousEnd) },
  };
}
