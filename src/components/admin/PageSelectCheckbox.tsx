import React, { useEffect, useRef } from 'react';

interface PageSelectCheckboxProps {
  ids: string[];
  selected: Set<string>;
  onToggle: (ids: string[]) => void;
}

// Header checkbox that selects every row on the page. Shows a dash when only some are selected.
export const PageSelectCheckbox: React.FC<PageSelectCheckboxProps> = ({ ids, selected, onToggle }) => {
  const ref = useRef<HTMLInputElement>(null);
  const count = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && count === ids.length;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && !all;
  }, [count, all]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Select all registrations on this page"
      // The selection bar returns focus here when it closes
      data-bulk-return-focus=""
      checked={all}
      onChange={() => onToggle(ids)}
      className="rounded border-gray-300 text-primary focus:ring-primary"
    />
  );
};

export default PageSelectCheckbox;
