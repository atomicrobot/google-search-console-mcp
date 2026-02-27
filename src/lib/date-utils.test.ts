import { describe, it, expect, afterEach, setSystemTime } from "bun:test";
import {
  getDefaultDateRange,
  getExtendedDateRange,
  getWowPeriods,
  getMomPeriods,
} from "@lib/date-utils";

describe("date-utils", () => {
  afterEach(() => {
    setSystemTime();
  });

  it("getDefaultDateRange returns last 28 days", () => {
    setSystemTime(new Date("2025-02-01T12:00:00Z"));
    const range = getDefaultDateRange();
    expect(range.startDate).toBe("2025-01-04");
    expect(range.endDate).toBe("2025-01-31");
  });

  it("getExtendedDateRange returns last 90 days", () => {
    setSystemTime(new Date("2025-04-01T12:00:00Z"));
    const range = getExtendedDateRange();
    expect(range.startDate).toBe("2025-01-01");
    expect(range.endDate).toBe("2025-03-31");
  });

  it("getWowPeriods returns two 7-day periods", () => {
    setSystemTime(new Date("2025-02-15T12:00:00Z"));
    const periods = getWowPeriods();
    expect(periods.current.startDate).toBe("2025-02-08");
    expect(periods.current.endDate).toBe("2025-02-14");
    expect(periods.previous.startDate).toBe("2025-02-01");
    expect(periods.previous.endDate).toBe("2025-02-07");
  });

  it("getMomPeriods returns two 28-day periods", () => {
    setSystemTime(new Date("2025-03-01T12:00:00Z"));
    const periods = getMomPeriods();
    expect(periods.current.startDate).toBe("2025-02-01");
    expect(periods.current.endDate).toBe("2025-02-28");
    expect(periods.previous.startDate).toBe("2025-01-04");
    expect(periods.previous.endDate).toBe("2025-01-31");
  });
});
