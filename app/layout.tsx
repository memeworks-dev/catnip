import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catnip",
  description:
    "Build, host, and spread interactive marketing toys. A MemeWorks company.",
};

// NOTE: ClerkProvider is intentionally not mounted here so the app boots without
// Clerk keys. It will wrap the dashboard route group when auth is built (§5).

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
