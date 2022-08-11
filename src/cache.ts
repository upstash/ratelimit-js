import { EphermeralCache } from "./types.ts";

export class Cache implements EphermeralCache {
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
}
