"use client";

import Link from 'next/link';
import { LayoutDashboard, Users, FolderKanban, Receipt, Wallet, Settings, Package, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, activePhase: true },
  { name: 'Creator Pool', href: '/creator-pool', icon: Users, activePhase: true },
  { name: 'Migrasi Data', href: '/import-data', icon: FolderKanban, activePhase: true },
  { name: 'Campaign', href: '/campaigns', icon: FolderKanban, activePhase: true },
  { name: 'Master Produk', href: '/skus', icon: Package, activePhase: true },
  { name: 'Input Penjualan', href: '/input-penjualan', icon: Receipt, activePhase: true },
  { name: 'Ads Report', href: '/ads-report', icon: FolderKanban, activePhase: true },
  { name: 'Budgeting & Topup', href: '/budgeting', icon: Wallet, activePhase: true },
  { name: 'Pengaturan', href: '/settings', icon: Settings, activePhase: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">TNT App</h1>
        <p className="text-xs text-slate-500 mt-1">Campaign Management</p>
      </div>
      
      {/* Profil User */}
      {profile && (
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden border-2 border-slate-700">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.nama} className="w-full h-full object-cover" />
            ) : (
              profile.nama?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile.nama}</p>
            <p className="text-xs text-slate-400 capitalize">{profile.role}</p>
          </div>
        </div>
      )}

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
      
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
        <p className="text-[10px] text-center text-slate-600 mt-4">
          TNT Agency &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
