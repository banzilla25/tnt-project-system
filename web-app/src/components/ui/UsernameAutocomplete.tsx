import React, { useState, useEffect, useRef, useMemo } from 'react';

export function UsernameAutocomplete({
  value,
  options,
  onChange,
  onCancel
}: {
  value: string;
  options: string[];
  onChange: (val: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  // Optimize: Pre-compute lowercase options only when options change
  const searchItems = useMemo(() => {
    return options.map(o => ({ original: o, lower: o.toLowerCase() }));
  }, [options]);

  // Optimize: Stop loop early when we hit 5 matches, instead of filtering all 10,000 rows
  const filtered = useMemo(() => {
    if (query.trim() === '') return searchItems.slice(0, 5).map(s => s.original);
    
    const qLower = query.toLowerCase();
    const result: string[] = [];
    
    for (let i = 0; i < searchItems.length; i++) {
      if (searchItems[i].lower.includes(qLower)) {
        result.push(searchItems[i].original);
        if (result.length >= 5) break; // Break early! Huge performance boost!
      }
    }
    return result;
  }, [query, searchItems]);

  return (
    <div ref={ref} className="relative z-50 min-w-[150px]">
      <input 
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value.replace(/\s+/g, ''))}
        className="p-1.5 text-xs border rounded-md border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.3)] outline-none w-full bg-white"
        placeholder="Ketik username..."
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onChange(query);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />
      {filtered.length > 0 && (
        <ul className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-md text-xs z-50 py-1">
          {filtered.map(opt => (
            <li 
              key={opt}
              onClick={() => onChange(opt)}
              className="px-3 py-2 hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-slate-700"
            >
              @{opt}
            </li>
          ))}
        </ul>
      )}
      {filtered.length === 0 && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border shadow-lg rounded-md text-xs z-50 p-2 text-slate-500 italic">
          Tidak ditemukan. Enter untuk pakai ini.
        </div>
      )}
    </div>
  );
}
