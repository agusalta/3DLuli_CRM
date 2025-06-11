import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3DLuli | Project generator",
  description: "Project generator",
  generator: "3d.dev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
