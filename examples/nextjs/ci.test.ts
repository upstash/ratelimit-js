import { test, expect, } from "bun:test";

const deploymentURL = process.env.DEPLOYMENT_URL ?? "http://127.0.0.1:3000";
if (!deploymentURL) {
	throw new Error("DEPLOYMENT_URL not set");
}

test("the server is running", async () => {
	console.log(`${deploymentURL}/api`);
	const res = await fetch(`${deploymentURL}/api`);

	if (res.status !== 200) {
		console.log(await res.text());
	}
	expect(res.status).toEqual(200);
}, { timeout: 10000 });

test("the pages router example is working", async () => {
	console.log(`${deploymentURL}/api/pages-test`);
	const res = await fetch(`${deploymentURL}/api/pages-test`);

	if (res.status !== 200) {
		console.log(await res.text());
	}
	expect(res.status).toEqual(200);
}, { timeout: 10000 });