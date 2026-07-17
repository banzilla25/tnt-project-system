"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { X, Search } from 'lucide-react';

export type FilterType = 'none' | 'include' | 'exclude';

interface CampaignFilterContextType {
  filterType: FilterType;
  setFilterType: (type: FilterType) => void;
  filterUsernames: string;
  setFilterUsernames: (usernames: string) => void;
  appliedFilterType: FilterType;
  setAppliedFilterType: (type: FilterType) => void;
  appliedFilterUsernames: string[];
  setAppliedFilterUsernames: (usernames: string[]) => void;
  isFilterModalOpen: boolean;
  setIsFilterModalOpen: (isOpen: boolean) => void;
  
  // Helper to easily check if a username should be rendered based on active filter
  isCreatorVisible: (username: string | null | undefined) => boolean;
}

const CampaignFilterContext = createContext<CampaignFilterContextType | undefined>(undefined);

interface CampaignFilterProviderProps {
  children: ReactNode;
  initialFilterType?: FilterType;
  initialFilterUsernames?: string;
  onSaveFilter?: (type: FilterType, usernames: string) => Promise<void>;
}

export function CampaignFilterProvider({ children, initialFilterType = 'none', initialFilterUsernames = '', onSaveFilter }: CampaignFilterProviderProps) {
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>(initialFilterType);
  const [filterUsernames, setFilterUsernames] = useState(initialFilterUsernames);
  
  const [appliedFilterType, setAppliedFilterType] = useState<FilterType>(initialFilterType);
  
  // parse initial usernames to array
  const initialNames = initialFilterUsernames.split('\n').map(n => n.trim().toLowerCase()).filter(n => n);
  const [appliedFilterUsernames, setAppliedFilterUsernames] = useState<string[]>(initialNames);

  // Sync when props change (e.g. data loaded asynchronously)
  React.useEffect(() => {
    setFilterType(initialFilterType);
    setFilterUsernames(initialFilterUsernames);
    setAppliedFilterType(initialFilterType);
    setAppliedFilterUsernames(initialFilterUsernames.split('\n').map(n => n.trim().toLowerCase()).filter(n => n));
  }, [initialFilterType, initialFilterUsernames]);

  const isCreatorVisible = (username: string | null | undefined) => {
    if (appliedFilterType === 'none' || appliedFilterUsernames.length === 0) return true;
    
    const uname = (username || '').toLowerCase();
    const match = appliedFilterUsernames.includes(uname);
    
    return appliedFilterType === 'include' ? match : !match;
  };

  return (
    <CampaignFilterContext.Provider value={{
      filterType, setFilterType,
      filterUsernames, setFilterUsernames,
      appliedFilterType, setAppliedFilterType,
      appliedFilterUsernames, setAppliedFilterUsernames,
      isFilterModalOpen, setIsFilterModalOpen,
      isCreatorVisible
    }}>
      {children}
      
      {/* GLOBAL FILTER MODAL */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Edit Global Creator Filter</h2>
              <button onClick={() => setIsFilterModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={filterType === 'include'} onChange={() => setFilterType('include')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                  <span className="text-sm font-medium text-slate-700">Include</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={filterType === 'exclude'} onChange={() => setFilterType('exclude')} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                  <span className="text-sm font-medium text-slate-700">Exclude</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer ml-auto">
                  <input type="radio" checked={filterType === 'none'} onChange={() => setFilterType('none')} className="w-4 h-4 text-slate-400 focus:ring-slate-500 border-gray-300" />
                  <span className="text-sm font-medium text-slate-500">Off / No Filter</span>
                </label>
              </div>

              {filterType !== 'none' && (
                <>
                  <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-md flex items-center gap-2 border border-blue-100">
                    <div className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">i</div>
                    Filter ini akan menyembunyikan kreator di SELURUH tab pada campaign ini (Listing, Video, Live, Performa, dll). Gunakan baris baru untuk memisahkan username.
                  </div>
                  
                  <div>
                    <textarea 
                      className="w-full h-48 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-y font-mono"
                      placeholder="username1&#10;username2&#10;username3"
                      value={filterUsernames}
                      onChange={e => setFilterUsernames(e.target.value)}
                    ></textarea>
                    <div className="text-right text-xs text-slate-400 mt-1">{filterUsernames.split(/[\s,]+/).filter(n => n.trim()).length} usernames detected</div>
                  </div>
                </>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors" onClick={() => setIsFilterModalOpen(false)}>
                Cancel
              </button>
              <button 
                className="px-5 py-2 text-sm font-bold text-white bg-[#0e9f85] hover:bg-[#0c8a73] rounded-lg transition-colors shadow-sm"
                onClick={async () => {
                  setAppliedFilterType(filterType);
                  const names = filterUsernames.split('\n').map(n => n.trim().toLowerCase()).filter(n => n);
                  setAppliedFilterUsernames(names);
                  
                  if (onSaveFilter) {
                    await onSaveFilter(filterType, filterUsernames);
                  }
                  
                  setIsFilterModalOpen(false);
                }}
              >
                Apply Global Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </CampaignFilterContext.Provider>
  );
}

export function useCampaignFilter() {
  const context = useContext(CampaignFilterContext);
  if (context === undefined) {
    throw new Error('useCampaignFilter must be used within a CampaignFilterProvider');
  }
  return context;
}
