import type { Metadata } from "next";

function getPlatformName(redirectUri: string | null): string {
  if (!redirectUri) return "Claude";
  try {
    const url = new URL(redirectUri);
    if (url.hostname.includes("chatgpt.com")) return "ChatGPT";
    if (url.hostname.includes("claude.ai")) return "Claude";
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return "Claude Desktop";
  } catch {
    // Invalid URL, fall back to default
  }
  return "Claude";
}

type Props = {
  searchParams: Promise<{ redirect_uri?: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const platform = getPlatformName(searchParams.redirect_uri ?? null);
  return {
    title: `Connect ${platform}`,
    description: `Authorize ${platform} to access the Odigo CRM pipeline.`,
  };
}

export default function McpAuthorizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
