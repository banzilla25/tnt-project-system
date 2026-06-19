import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { DataLoader } from "@/components/DataLoader";
export const metadata: Metadata = {
  title: "TNT Campaign Management",
  description: "Internal dashboard for TNT affiliate campaigns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="font-sans bg-slate-50 text-slate-900 min-h-screen flex">
        <DataLoader />
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
