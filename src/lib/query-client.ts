import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,   // 5 min — cache is fresh, skip redundant fetches
        gcTime: 10 * 60 * 1000,      // 10 min — keep unused cache in memory
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

// Server: always a fresh instance (per-request isolation).
// Browser: a stable singleton so the cache survives between page navigations.
export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
