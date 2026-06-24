import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface Option {
  id: number | string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  emptyMessage?: string;
}

export function MultiSelect({ options, selectedIds, onChange, placeholder = "Pilih opsi...", emptyMessage = "Tidak ada pilihan" }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleOption = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(val => val !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedOptions = options.filter(opt => selectedIds.includes(Number(opt.id)));

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        className="min-h-[36px] w-full border border-slate-300 rounded-md bg-white p-1.5 flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {selectedOptions.length === 0 ? (
            <span className="text-xs text-slate-400 pl-1">{placeholder}</span>
          ) : (
            selectedOptions.map(opt => (
              <span key={opt.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-100">
                {opt.label}
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(Number(opt.id));
                  }}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">{emptyMessage}</div>
          ) : (
            <div className="py-1">
              {options.map(opt => {
                const isSelected = selectedIds.includes(Number(opt.id));
                return (
                  <div 
                    key={opt.id} 
                    className={`flex items-center px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}
                    onClick={() => toggleOption(Number(opt.id))}
                  >
                    <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <span className={isSelected ? 'font-medium text-blue-900' : 'text-slate-700'}>{opt.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
