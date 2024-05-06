export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return new Response("Rate Limited!", {status: 429});
}