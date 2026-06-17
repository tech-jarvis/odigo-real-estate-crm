import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * GET /api/cron/cleanup-projects
 *
 * Permanently removes soft-deleted projects older than 15 days.
 * Protected by a shared secret — set CRON_SECRET in env vars and pass it as
 * the Authorization header: `Bearer <CRON_SECRET>`.
 *
 * Vercel Cron (vercel.json) automatically passes this header when CRON_SECRET
 * is set in the project's environment variables.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS, since this endpoint runs
 * without a user session.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
