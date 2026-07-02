"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export function StringCombobox({ 
  value, 
  onChange, 
  options, 
  placeholder,
  className = "w-full p-3 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-slate-50 text-sm"
}: { 
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
        // On blur, commit the search value
        if (search !== value) {
          onChange(search);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [search, value, onChange]);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()) && opt !== search);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          className={className}
          placeholder={placeholder}
          value={search}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <div 
          className="absolute inset-y-0 right-0 flex items-center pr-2 cursor-pointer text-slate-400 hover:text-slate-600"
          onClick={() => setOpen(!open)}
        >
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center italic">
              {search ? `"${search}" (Pilih sebagai nama baru)` : "Ketik untuk opsi baru..."}
            </div>
          ) : (
            <>
              {filteredOptions.map((opt, i) => (
                <div
                  key={i}
                  className="p-3 text-sm hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                  onClick={() => {
                    setSearch(opt);
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  {opt}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
