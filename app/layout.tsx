import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catnip",
  description:
    "Build, host, and spread interactive marketing toys. A MemeWorks company.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tree = (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );

  // Mount ClerkProvider only when configured, so the app (and public toys) boot
  // without Clerk keys. Toys remain public regardless — only /dashboard is
  // protected by the proxy.
  return isClerkConfigured() ? <ClerkProvider>{tree}</ClerkProvider> : tree;
}
