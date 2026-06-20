"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

type Profile = {
  id: string;
  nama: string;
  email: string;
  avatar_url: string | null;
  role: string;
  status: string;
};

type UserCampaign = {
  campaign_id: number;
  all_campaigns: boolean;
};

type AuthContextType = {
  profile: Profile | null;
  userCampaigns: UserCampaign[];
  isLoading: boolean;
  canEditCampaign: (campaignId: number) => boolean;
};

const AuthContext = createContext<AuthContextType>({
  profile: null,
  userCampaigns: [],
  isLoading: true,
  canEditCampaign: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userCampaigns, setUserCampaigns] = useState<UserCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) setIsLoading(false);
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData && mounted) {
          setProfile(profileData);
          
          if (profileData.role === 'anggota') {
            const { data: ucData } = await supabase
              .from('user_campaigns')
              .select('campaign_id, all_campaigns')
              .eq('user_id', user.id);
            
            if (ucData) {
              setUserCampaigns(ucData);
            }
          }
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const canEditCampaign = (campaignId: number) => {
    if (isLoading) return false;
    if (!profile) return false;
    if (profile.role === 'manager') return true;
    
    // Anggota checks
    if (userCampaigns.some(uc => uc.all_campaigns)) return true;
    return userCampaigns.some(uc => uc.campaign_id === campaignId);
  };

  return (
    <AuthContext.Provider value={{ profile, userCampaigns, isLoading, canEditCampaign }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
