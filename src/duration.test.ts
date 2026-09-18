import { describe, expect, it } from "bun:test";
import { ms } from "./duration";

describe("ms", () => {
  it("should return the correct number of milliseconds for a given duration", () => {
    expect(ms("100ms")).toBe(100);
    expect(ms("2s")).toBe(2000);
    expect(ms("3m")).toBe(180_000);
    expect(ms("4h")).toBe(14_400_000);
    expect(ms("5d")).toBe(432_000_000);
    expect(ms("10ms")).toBe(10);
  });
  describe("with space", () => {
    it("should return the correct number of milliseconds for a given duration", () => {
      expect(ms("100 ms")).toBe(100);
      expect(ms("2 s")).toBe(2000);
      expect(ms("3 m")).toBe(180_000);
      expect(ms("4 h")).toBe(14_400_000);
      expect(ms("5 d")).toBe(432_000_000);
      expect(ms("10 ms")).toBe(10);
    });
  });
  describe("decimals and weeks", () => {
    it("should return correct milliseconds for decimal values and weeks", () => {
      expect(ms("1.5s")).toBe(1500);
      expect(ms("0.5 h")).toBe(1_800_000);
      expect(ms("2.5m")).toBe(150_000);
      expect(ms("1w")).toBe(604_800_000);
      expect(ms("0.5 w")).toBe(302_400_000);
    });
    it("should throw when the duration rounds to 0 ms", () => {
      expect(() => ms("0.4ms")).toThrow("Window size must be at least 1 ms");
      expect(() => ms("0.0001 s")).toThrow("Window size must be at least 1 ms");
      expect(() => ms("0 s")).toThrow("Window size must be at least 1 ms");
    });
  });
});
