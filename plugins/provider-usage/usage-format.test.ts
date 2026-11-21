import { describe, expect, it } from "vitest";
import { formatUsagePace, usagePace, usageWindowMinutes } from "./usage-format.js";

const HOUR = 3_600_000;
const NOW = Date.parse("2026-11-21T14:00:00Z");
const resetIn = (hours: number) => new Date(NOW + hours * HOUR).toISOString();

describe("usageWindowMinutes", () => {
  it("maps known labels", () => {
    expect(usageWindowMinutes("Weekly limit")).toBe(10_080);
    expect(usageWindowMinutes("Weekly · Fable")).toBe(10_080);
    expect(usageWindowMinutes("Five-hour limit")).toBe(300);
    expect(usageWindowMinutes("30 day limit")).toBe(43_200);
    expect(usageWindowMinutes("Monthly credits")).toBeNull();
  });
});

describe("usagePace", () => {
  it("lasts until reset when under pace", () => {
    // 20h left of 168h: 88% of the window gone, 38% used.
    const pace = usagePace(38, resetIn(20), 10_080, NOW)!;
    expect(Math.round(pace.reservePercent)).toBe(50);
    expect(pace.lastsUntilReset).toBe(true);
    expect(formatUsagePace(pace)).toBe("50% in reserve · Lasts until reset");
  });

  it("projects run-out when ahead of pace", () => {
    // 2 days into a 7-day window with 60% used: 40% more takes ~1d 8h.
    const pace = usagePace(60, resetIn(120), 10_080, NOW)!;
    expect(pace.lastsUntilReset).toBe(false);
    expect(pace.runsOutInMs).toBeCloseTo(32 * HOUR, -3);
    expect(formatUsagePace(pace)).toBe("31% ahead of pace · Runs out in 1d 8h");
  });

  it("returns null when it cannot judge", () => {
    expect(usagePace(10, null, 10_080, NOW)).toBeNull();
    expect(usagePace(10, resetIn(20), null, NOW)).toBeNull();
    expect(usagePace(1, resetIn(167.9), 10_080, NOW)).toBeNull();
    expect(usagePace(10, resetIn(-1), 10_080, NOW)).toBeNull();
  });

  it("reports a reached limit", () => {
    expect(formatUsagePace(usagePace(100, resetIn(20), 10_080, NOW)!)).toBe("Limit reached");
  });
});
