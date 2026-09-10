import { hostingHealth } from "../../../lib/hosting-health.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await hostingHealth(process.env);
  return Response.json(health, { status: health.healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
