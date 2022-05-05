# Upstash Redis

An HTTP/REST based Redis client built on top of Upstash REST API.
[Upstash REST API](https://docs.upstash.com/features/restapi).

[![Tests](https://github.com/upstash/ratelimiter/actions/workflows/tests.yaml/badge.svg)](https://github.com/upstash/ratelimiter/actions/workflows/tests.yaml)
![npm (scoped)](https://img.shields.io/npm/v/@upstash/redis)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/@upstash/redis)

It is the only connectionless (HTTP based) ratelimiter and designed for:

- Serverless functions (AWS Lambda ...)
- Cloudflare Workers
- Fastly Compute@Edge (see
- Next.js, Jamstack ...
- Client side web/mobile applications
- WebAssembly
- and other environments where HTTP is preferred over TCP.

## Docs

See [the documentation](https://docs.upstash.com/features/javascriptsdk) for
details.

## Contributing

### Installing dependencies

```bash
pnpm install
```

### Database

Create a new redis database on [upstash](https://console.upstash.com/) and copy
the url and token to `.env` (See `.env.example` for reference)

### Running tests

```sh
pnpm test
```
