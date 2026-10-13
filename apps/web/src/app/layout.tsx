import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/google-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Wally", template: "%s · Wally" },
  description: "Your personal waiter. Wally finds your food across the delivery apps and restaurants’ own sites, local spots first, and books your tables.",
};

export const viewport: Viewport = { themeColor: "#f4f6fa" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
