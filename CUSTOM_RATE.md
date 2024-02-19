# Custom Rates
Custom rates are reinforcements to regular rate limiters, it can be helpful if you want to explicitly limit the request that could have a large request body which may overwhelm your server if these requests successfully pass through the regular rate limiter in a given window. 

To add custom rates, first, you need to pass one more argument to the limiter function which will be the maximum custom rates the limiter can have in a given window:
```typescript
Ratelimit.slidingWindow(10, "10 s", 400)
```
After that you need to provide the rate each request will consume in a given window like this:
```typescript
const identifier = "api";
const { success } = await ratelimit.limit(identifier, {rate: 100});
```
You can calculate the rate each request will consume based on your own logic.

## Usage

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  // limiter with max custom rates
  limiter: Ratelimit.slidingWindow(10, "10 s", 400),
  analytics: true,
  prefix: "@upstash/ratelimit",
});

const identifier = "api";
// rate each request will consume if they are allowed to pass
const { success } = await ratelimit.limit(identifier, {rate: 100});

if (!success) {
  return "Unable to process at this time";
}
doExpensiveCalculation();
return "Here you go!";
```