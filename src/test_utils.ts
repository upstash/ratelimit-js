import crypto from "node:crypto";
import type { Ratelimit } from "./ratelimit";
import type { Context } from "./types";

type Metrics = {
  requests: number;
  success: number;
  rejected: number;
};
export class TestHarness<TContext extends Context> {
  /**
   * Used as prefix for redis keys
   */
  public readonly id: string;

  private readonly ratelimit: Ratelimit<TContext>;
  public metrics: Metrics;

  public latencies: Record<string, { start: number; end: number }> = {};

  constructor(ratelimit: Ratelimit<TContext>) {
    this.ratelimit = ratelimit;
    this.id = crypto.randomUUID();
    this.metrics = {
      requests: 0,
      success: 0,
      rejected: 0,
    };
  }

  /**
   * @param rps - req per second
   * @param duration - duration in seconds
   */
  public async attack(rps: number, duration: number, rate?: number): Promise<void> {
    const promises: Promise<{ success: boolean; pending: Promise<unknown> }>[] = [];

    // Spread `rps * duration` requests evenly over `duration` seconds, scheduling each one
    // against the attack start time so timer drift and non-integer rps do not stretch the
    // attack. (Looping `rps` times per second with a `1000 / rps` sleep sent ceil(rps)
    // requests per second, e.g. 3.2 req/s for 8 s took 10 s and straddled an extra window.)
    const requestCount = Math.round(rps * duration);
    const interval = (duration * 1000) / requestCount;
    const start = Date.now();

    for (let i = 0; i < requestCount; i++) {
      const delay = start + i * interval - Date.now();
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
      this.metrics.requests++;
      const id = crypto.randomUUID();
      this.latencies[id] = { start: Date.now(), end: -1 };
      promises.push(
        this.ratelimit.limit(this.id, { rate }).then((res) => {
          this.latencies[id].end = Date.now();
          return res;
        }),
      );
    }

    await Promise.all(
      promises.map(async (p) => {
        const { success, pending } = await p;
        await pending;
        if (success) {
          this.metrics.success++;
        } else {
          this.metrics.rejected++;
        }
      }),
    );
  }
}
