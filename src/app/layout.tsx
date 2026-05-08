import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ledger Bet",
  description: "Forecasting ledger demo with Next.js, Prisma, and SQLite",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
