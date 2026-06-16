import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/cleanup-projects
 *
 * Permanently removes soft-deleted projects older than 15 days.
 * Protected by a shared secret — set CRON_SECRET in env vars and pass it as
 * the Authorization header: `Bearer <CRON_SECRET>`.
 *
 * Schedule this endpoint with any cron service (Vercel Cron, GitHub Actions,
 * pg_cron via `net.http_get(...)`, etc.) to run daily.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from("projects")
    .delete({ count: "exact" })
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff);

  if (error) {
    console.error("[cleanup-projects]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deleted: count ?? 0,
    cutoff,
  });
}
