import { Redis } from "@upstash/redis";
import { Ratelimit } from "./ratelimiter";
async function main() {
	const ratelimit = new Ratelimit({
		redis: Redis.fromEnv(),
		limiter: Ratelimit.tokenBucket("2 s", 5, 10),
	});

	let success = 0;
	let failed = 0;
	const now = Date.now();
	const p = [];
	const n = 30;
	for (let i = 0; i < n; i++) {
		const res = ratelimit
			.limit("Andreas")
			.then((res) => {
				console.log({ res });
				if (res.success) {
					success++;
				} else {
					failed++;
				}
			});
		p.push(res);
		await res;
	}
	await Promise.all(p);
	console.log({ success, failed });
	console.log({
		total: (Date.now() - now) / 1000,
		average: (Date.now() - now) / 1000 / n,
		"s/op": n / ((Date.now() - now) / 1000),
	});
}

main();
