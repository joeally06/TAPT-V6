import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { filterJumpEntries, getJumpEntries } from '../../lib/adminNav';

interface AdminJumpMenuProps {
  open: boolean;
  onClose: () => void;
}

// "Jump to…" box: type a few letters, press Enter to go to that admin page.
export const AdminJumpMenu: React.FC<AdminJumpMenuProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const entries = useMemo(getJumpEntries, []);
  const results = useMemo(() => filterJumpEntries(entries, query), [entries, query]);

  // Start fresh each time it opens, and give focus back to where the user was when it closes.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    setQuery('');
    setActiveIndex(0);
    inputRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) go(target.path);
    } else if (event.key === 'Tab') {
      // Keep focus in the box while it is open
      event.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[15vh]">
      <div className="absolute inset-0 bg-gray-900/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a page"
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
          <Search className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="admin-jump-results"
            aria-activedescendant={results[activeIndex] ? `admin-jump-option-${activeIndex}` : undefined}
            aria-label="Search admin pages"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to a page, for example scholarships"
            className="w-full border-0 bg-transparent p-0 text-sm text-gray-900 placeholder-gray-400 focus:ring-0"
          />
          <kbd className="flex-shrink-0 rounded border border-gray-300 px-1.5 text-xs text-gray-500">Esc</kbd>
        </div>

        <ul id="admin-jump-results" role="listbox" aria-label="Pages" className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-gray-500">No pages match "{query}".</li>
          ) : (
            results.map((entry, index) => (
              <li
                key={entry.path + entry.label}
                id={`admin-jump-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(entry.path)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${
                  index === activeIndex ? 'bg-tapt-blue text-white' : 'text-gray-900'
                }`}
              >
                <span className="min-w-0 truncate">{entry.label}</span>
                <span className={`flex-shrink-0 text-xs ${index === activeIndex ? 'text-white/80' : 'text-gray-500'}`}>
                  {entry.group}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default AdminJumpMenu;
