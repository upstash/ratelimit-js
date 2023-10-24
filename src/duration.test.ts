import { describe, expect, it } from "bun:test";
import { ms } from "./duration";

describe("ms", () => {
  it("should return the correct number of milliseconds for a given duration", () => {
    expect(ms("100ms")).toBe(100);
    expect(ms("2s")).toBe(2000);
    expect(ms("3m")).toBe(180000);
    expect(ms("4h")).toBe(14400000);
    expect(ms("5d")).toBe(432000000);
    expect(ms("10ms")).toBe(10);
  });
  describe("with space", () => {
    it("should return the correct number of milliseconds for a given duration", () => {
      expect(ms("100 ms")).toBe(100);
      expect(ms("2 s")).toBe(2000);
      expect(ms("3 m")).toBe(180000);
      expect(ms("4 h")).toBe(14400000);
      expect(ms("5 d")).toBe(432000000);
      expect(ms("10 ms")).toBe(10);
    });
  });
});
