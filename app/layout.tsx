import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Courseflow — Assignment Planner",
  description: "A difficulty-aware plan for every assignment, starting at least two days before it is due.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
