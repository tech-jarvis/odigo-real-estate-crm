-- ============================================================
-- Odigo CRM — MCP Auth Codes (10)
-- Short-lived OAuth authorization codes for the MCP HTTP server.
-- Stored in DB so the auth code survives across serverless invocations.
-- ============================================================

create table if not exists public.mcp_auth_codes (
  code           text primary key,
  access_token   text not null,
  code_challenge text not null,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

-- Cleanup index for expired rows
create index if not exists idx_mcp_auth_codes_expires
  on public.mcp_auth_codes (expires_at);
