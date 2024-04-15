import type { EphemeralCache } from "./types";

export class Cache implements EphemeralCache {
  /**
   * Stores identifier -> reset (in milliseconds)
   */
  private readonly cache: Map<string, number>;

  constructor(cache: Map<string, number>) {
    this.cache = cache;
  }

  public isBlocked(identifier: string): { blocked: boolean; reset: number } {
    if (!this.cache.has(identifier)) {
      return { blocked: false, reset: 0 };
    }
    const reset = this.cache.get(identifier)!;
    if (reset < Date.now()) {
      this.cache.delete(identifier);
      return { blocked: false, reset: 0 };
    }

    return { blocked: true, reset: reset };
  }

  public blockUntil(identifier: string, reset: number): void {
    this.cache.set(identifier, reset);
  }

  public set(key: string, value: number): void {
    this.cache.set(key, value);
  }
  public get(key: string): number | null {
    return this.cache.get(key) || null;
  }

  public incr(key: string): number {
    let value = this.cache.get(key) ?? 0;
    value += 1;
    this.cache.set(key, value);
    return value;
  }

  public pop(key: string): void {
    this.cache.delete(key)
  }

  public empty(): void {
    this.cache.clear()
  }
}
