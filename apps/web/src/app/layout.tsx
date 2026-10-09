import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/fredoka";
import "@fontsource-variable/figtree";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Wally", template: "%s · Wally" },
  description: "A waiter you can text. Wally orders your food and books your tables.",
};

export const viewport: Viewport = { themeColor: "#f4f6fa" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
