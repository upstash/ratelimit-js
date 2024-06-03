# Using deny list by enabling protection

To use enable list, simply set the `enableProtection` parameter to true when
initializing the Upstash Redis client.

```tsx
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  prefix: "@upstash/ratelimit",
  analytics: true,
  enableProtection: true
});
```

When this parameter is enabled, redis client will check the identifier and
other parameters against a dent list managed through [Ratelimit Dashboard](https://console.upstash.com/ratelimit).

When analytics is set to true, requests blocked with the deny list are
logged under Denied and shown in the dashboard.

In addition to passing an identifier, you can pass IP address, user agent
and country in the `limit` method. If any of these values is in the deny
list, the request will be denied.

```tsx
const { success, limit, remaining, pending, reason } = await ratelimit.limit(
  identifier, {
    ip: ipAddress,
    userAgent: userAgent,
    country: country
  }
);
```

With this change, we also introduce the reason parameter, which denotes
whether a request passed with timeout or rejected with caching or deny list.

# Running the example locally

To run the example, simply create a Redis instance from Upstash
console and save the URL and the token to this directory under a
`.env` file.

Then run `npm run dev`.
