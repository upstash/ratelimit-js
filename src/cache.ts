import { EphermeralCache } from "./types.ts";

export class Cache implements EphermeralCache {
  /**
   * Stores identifier -> reset (in milliseconds)
   */
  private readonly cache: Map<string, number> = new Map();

  public isBlocked(identifier: string): { blocked: boolean; reset: number } {
    if (!this.cache.has(identifier)) {
      return { blocked: false, reset: 0 };
    }
    const reset = this.cache.get(identifier)!;
    if (reset < Date.now()) {
      this.cache.delete(identifier);
      return { blocked: false, reset: 0 };
    }

    console.log(`[CACHE] isBlocked(${identifier}) -> true`);

    return { blocked: true, reset: reset };
  }

  public blockUntil(identifier: string, reset: number): void {
    this.cache.set(identifier, reset);
  }
}
