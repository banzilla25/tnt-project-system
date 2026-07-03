import React from 'react';
import Link from 'next/link';

export default function BrandPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <nav className="bg-white dark:bg-gray-800 shadow p-4 flex space-x-4">
        <Link href="/brand-portal/summary">
          <a className="text-lg font-medium hover:underline">Summary</a>
        </Link>
        {/* Add other brand‑portal links here if needed */}
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
