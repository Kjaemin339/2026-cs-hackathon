import { cleanupRequest } from "../../../../lib/retention-handler";
import { getStorage } from "../../../../lib/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: Request) {
  return cleanupRequest(req, process.env.CRON_SECRET, getStorage);
}
