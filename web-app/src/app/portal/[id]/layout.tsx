import "@/app/globals.css"; // Ensure globals is imported
export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="font-sans bg-slate-50 text-slate-900 min-h-screen">
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
