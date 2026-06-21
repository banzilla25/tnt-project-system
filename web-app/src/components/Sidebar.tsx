"use client";

import Link from 'next/link';
import { LayoutDashboard, Users, FolderKanban, Receipt, Wallet, Settings, Package, LogOut, Shield, Activity, Puzzle } from 'lucide-react';
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
  { name: 'Unduh Ekstensi', href: '/extension', icon: Puzzle, activePhase: true },
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
    <div className="navdemo">
      <div className="navbrand">
        TNT App
        <small>Campaign Management</small>
      </div>
      
      {/* Profil User */}
      {profile && (
        <div className="flex items-center gap-[11px] px-[12px] py-[8px] mb-[4px]">
          <div className="avatar bg-p300 shadow-sm border border-white/10 text-[13px]">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.nama} className="w-full h-full object-cover rounded-full" />
            ) : (
              profile.nama?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white truncate">{profile.nama}</p>
            <p className="text-[11px] text-white/50 capitalize font-medium">{profile.role}</p>
          </div>
        </div>
      )}

      <nav className="flex-1 flex flex-col overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.activePhase ? item.href : '#'}
              className={cn(
                'navitem',
                isActive && 'active',
                !item.activePhase && 'opacity-50 cursor-not-allowed'
              )}
              onClick={(e) => {
                if (!item.activePhase) {
                  e.preventDefault();
                  alert('Menu ini akan tersedia pada Fase berikutnya.');
                }
              }}
            >
              <Icon className="ico" />
              {item.name}
              {!item.activePhase && (
                <span className="ml-auto text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded">Lock</span>
              )}
            </Link>
          );
        })}
        
        {/* Khusus Manager */}
        {profile?.role === 'manager' && (
          <div className="mt-2">
            <div className="navsection">Manager Tools</div>
            <Link
              href="/manajemen-akun"
              className={cn(
                'navitem tool',
                pathname.startsWith('/manajemen-akun') && 'active'
              )}
            >
              <Shield className="ico" />
              Manajemen Akun
            </Link>
            <Link
              href="/activity-log"
              className={cn(
                'navitem tool',
                pathname.startsWith('/activity-log') && 'active'
              )}
            >
              <Activity className="ico" />
              Activity Log
            </Link>
          </div>
        )}
      </nav>
      
      <div className="mt-4 pt-4 border-t border-white/10">
        <button 
          onClick={handleLogout}
          className="navitem w-full"
        >
          <LogOut className="ico" />
          Logout
        </button>
        <p className="text-[10px] text-center text-white/30 mt-4 font-medium tracking-wide">
          TNT Agency &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
