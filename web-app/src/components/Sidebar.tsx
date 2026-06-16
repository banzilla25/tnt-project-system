"use client";

import Link from 'next/link';
import { LayoutDashboard, Users, FolderKanban, Receipt, Wallet, Settings, Package } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, activePhase: true },
  { name: 'Creator Pool', href: '/creator-pool', icon: Users, activePhase: true },
  { name: 'Campaign', href: '/campaigns', icon: FolderKanban, activePhase: true },
  { name: 'Master SKU', href: '/skus', icon: Package, activePhase: true },
  { name: 'Input Penjualan', href: '/input-penjualan', icon: Receipt, activePhase: true },
  { name: 'Ads Report', href: '/ads-report', icon: FolderKanban, activePhase: true },
  { name: 'Budgeting & Topup', href: '/budgeting', icon: Wallet, activePhase: true },
  { name: 'Invoice & Payout', href: '/invoice', icon: Receipt, activePhase: true },
  { name: 'Pengaturan', href: '/settings', icon: Settings, activePhase: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">TNT App</h1>
        <p className="text-xs text-slate-500 mt-1">Campaign Management</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.activePhase ? item.href : '#'}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium',
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : item.activePhase 
                    ? 'hover:bg-slate-800 hover:text-white' 
                    : 'opacity-50 cursor-not-allowed'
              )}
              onClick={(e) => {
                if (!item.activePhase) {
                  e.preventDefault();
                  alert('Menu ini akan tersedia pada Fase berikutnya.');
                }
              }}
            >
              <Icon className="w-4 h-4" />
              {item.name}
              {!item.activePhase && (
                <span className="ml-auto text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">Lock</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-center text-slate-500">
        TNT Agency &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}
