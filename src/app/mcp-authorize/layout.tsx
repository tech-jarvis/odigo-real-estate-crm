import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect to CRM",
  description: "Authorize your AI platform to access the Odigo CRM pipeline.",
};

export default function McpAuthorizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
