import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
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
        <Sidebar />
        <main className="flex-1 ml-64 min-w-0 flex flex-col h-screen overflow-y-auto bg-slate-50">
          <div className="p-8 mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
