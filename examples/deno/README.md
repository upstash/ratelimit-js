
## Deno Examples

This directory has two deno examples.

| File            | Description |
| --------------- | ----------- |
| `deprecated.ts` | Deno app with the `serve` method which was deprecated with Deno version `0.107.0`. |
| `main.ts`       | Up-to-date Deno app with the `Deno.serve` method |

To run the apps locally, simply set the environment variables `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` and run:

```
deno run --allow-net --allow-env main.ts
```