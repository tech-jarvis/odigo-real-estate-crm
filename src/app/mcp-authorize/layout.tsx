import type { Metadata } from "next";

// page.tsx here is a client component, which can't export metadata itself —
// this layout carries it instead.
export const metadata: Metadata = {
  title: "Connect Claude AI",
  description: "Authorize Claude AI to access the Odigo CRM pipeline.",
};

export default function McpAuthorizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
