import React from 'react';

interface PaginationBarProps {
  page: number;
  pageSize: number;
  // Rows on this page and rows in all
  shown: number;
  total: number;
  onPageChange: (page: number) => void;
}

const BUTTON = 'rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50';

// "Showing 21-40 of 63" with Previous and Next, for the admin lists.
export const PaginationBar: React.FC<PaginationBarProps> = ({ page, pageSize, shown, total, onPageChange }) => {
  const first = shown ? (page - 1) * pageSize + 1 : 0;
  const last = (page - 1) * pageSize + shown;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-gray-600">
      <p aria-live="polite">
        Showing {first}-{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className={BUTTON}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          type="button"
          onClick={() => onPageChange(page * pageSize < total ? page + 1 : page)}
          disabled={page * pageSize >= total}
          aria-label="Next page"
          className={BUTTON}
        >
          Next
        </button>
      </div>
    </nav>
  );
};

export default PaginationBar;
