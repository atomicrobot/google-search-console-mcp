import { describe, it, expect, beforeEach } from "bun:test";
import { loadConfig } from "@config";
import { testEnv, testLog } from "@tools/test-helpers";
import { listSchema } from "@tools/list-schema";

describe("listSchema", () => {
  beforeEach(() => {
    loadConfig(testEnv);
  });

  it("returns dimensions array", () => {
    const result = listSchema(testLog);
    expect(result.dimensions).toBeDefined();
    expect(Array.isArray(result.dimensions)).toBe(true);
    expect(result.dimensions.length).toBeGreaterThan(0);
  });

  it("returns metrics array", () => {
    const result = listSchema(testLog);
    expect(result.metrics).toBeDefined();
    expect(Array.isArray(result.metrics)).toBe(true);
    expect(result.metrics.length).toBeGreaterThan(0);
  });

  it("returns notes array", () => {
    const result = listSchema(testLog);
    expect(result.notes).toBeDefined();
    expect(Array.isArray(result.notes)).toBe(true);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("includes expected dimensions", () => {
    const result = listSchema(testLog);
    const dimensionNames = result.dimensions.map((d) => d.name);
    expect(dimensionNames).toContain("query");
    expect(dimensionNames).toContain("page");
    expect(dimensionNames).toContain("country");
    expect(dimensionNames).toContain("device");
    expect(dimensionNames).toContain("date");
  });

  it("includes expected metrics", () => {
    const result = listSchema(testLog);
    const metricNames = result.metrics.map((m) => m.name);
    expect(metricNames).toContain("clicks");
    expect(metricNames).toContain("impressions");
    expect(metricNames).toContain("ctr");
    expect(metricNames).toContain("position");
  });

  it("dimensions have name and description", () => {
    const result = listSchema(testLog);
    for (const dim of result.dimensions) {
      expect(dim.name).toBeDefined();
      expect(dim.description).toBeDefined();
    }
  });

  it("metrics have name and description", () => {
    const result = listSchema(testLog);
    for (const metric of result.metrics) {
      expect(metric.name).toBeDefined();
      expect(metric.description).toBeDefined();
    }
  });
});
