
## Local Development

For testing the app locally, start by creating an Upstash Redis. Next, create the `.dev.vars` file under `cloudflare-workers` directory and set the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables:

```
// .dev.vars
UPSTASH_REDIS_REST_URL="****"
UPSTASH_REDIS_REST_TOKEN="****"
```

Then, simply run:

```
npx wrangler dev
```

## Deploy on Cloudflare

To deploy the app, set the environment variables with the following lines. In both cases, you will be prompted to enter the secret value:

```
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

Then, deploy the project with:

```
npx wrangler deploy
```