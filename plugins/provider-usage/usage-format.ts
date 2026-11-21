export function usageBarColorClass(usedPercent: number): string {
  if (usedPercent >= 95) return "bg-destructive";
  if (usedPercent >= 80) return "bg-warning";
  return "bg-primary";
}

export function formatUsageReset(resetsAt: string | null): string | null {
  if (resetsAt === null) return null;
  const reset = new Date(resetsAt);
  if (Number.isNaN(reset.getTime())) return null;
  const diffMs = reset.getTime() - Date.now();
  if (diffMs <= 0) return "Resetting now";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `Resets in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes === 0
      ? `Resets in ${hours} hr`
      : `Resets in ${hours} hr ${remainingMinutes} min`;
  }
  const withinWeek = diffMs < 7 * 24 * 60 * 60_000;
  const formatted = reset.toLocaleString(undefined, {
    weekday: withinWeek ? "short" : undefined,
    month: withinWeek ? undefined : "short",
    day: withinWeek ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Resets ${formatted}`;
}

export function formatUsdCents(
  cents: number,
  alwaysShowCents: boolean,
): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: alwaysShowCents || cents % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const MINUTE_MS = 60_000;

/** Window length implied by a usage window's label, or null when unknown. */
export function usageWindowMinutes(label: string): number | null {
  if (/^(Five-hour limit|5 hours)$/u.test(label)) return 300;
  if (/^Daily limit$/u.test(label)) return 1_440;
  if (/^Weekly/u.test(label)) return 10_080;
  const days = /^(\d+) day limit$/u.exec(label);
  if (days) return Number(days[1]) * 1_440;
  const hours = /^(\d+) hour limit$/u.exec(label);
  if (hours) return Number(hours[1]) * 60;
  return null;
}

export type UsagePace = {
  /** Where usage would be if spread evenly across the window, 0-100. */
  expectedPercent: number;
  /** expectedPercent minus usedPercent; negative when ahead of pace. */
  reservePercent: number;
  /** True when the current rate of use reaches the reset before 100%. */
  lastsUntilReset: boolean;
  /** Milliseconds from now until 100% at the current rate, when it won't last. */
  runsOutInMs: number | null;
};

/**
 * Projects a window's usage to its reset, assuming use continues at the
 * average rate seen so far this window. Returns null when the window length
 * or reset is unknown, or too little of the window has passed to judge.
 */
export function usagePace(
  usedPercent: number,
  resetsAt: string | null,
  windowMinutes: number | null,
  now = Date.now(),
): UsagePace | null {
  if (resetsAt === null || windowMinutes === null) return null;
  const reset = new Date(resetsAt).getTime();
  if (Number.isNaN(reset)) return null;
  const windowMs = windowMinutes * MINUTE_MS;
  const remainingMs = reset - now;
  if (remainingMs <= 0 || remainingMs > windowMs) return null;
  const elapsedMs = windowMs - remainingMs;
  if (elapsedMs < windowMs * 0.02) return null;
  const expectedPercent = (elapsedMs / windowMs) * 100;
  const reservePercent = expectedPercent - usedPercent;
  if (usedPercent >= 100)
    return { expectedPercent, reservePercent, lastsUntilReset: false, runsOutInMs: 0 };
  if (usedPercent <= 0)
    return { expectedPercent, reservePercent, lastsUntilReset: true, runsOutInMs: null };
  const runsOutInMs = ((100 - usedPercent) / usedPercent) * elapsedMs;
  const lastsUntilReset = runsOutInMs >= remainingMs;
  return {
    expectedPercent,
    reservePercent,
    lastsUntilReset,
    runsOutInMs: lastsUntilReset ? null : runsOutInMs,
  };
}

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return hours % 24 === 0 ? `${days}d` : `${days}d ${hours % 24}h`;
}

/** One-line pace summary, e.g. "50% in reserve · Lasts until reset". */
export function formatUsagePace(pace: UsagePace): string {
  const reserve = Math.round(pace.reservePercent);
  const lead =
    reserve >= 0 ? `${reserve}% in reserve` : `${-reserve}% ahead of pace`;
  if (pace.lastsUntilReset) return `${lead} · Lasts until reset`;
  if (pace.runsOutInMs === 0) return "Limit reached";
  return `${lead} · Runs out in ${formatDuration(pace.runsOutInMs ?? 0)}`;
}
