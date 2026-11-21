import React from 'react';
import { PAYMENT_FILTERS, type PaymentFilter } from '../../lib/registrationPayments';

interface PaymentFilterChipsProps {
  value: PaymentFilter;
  onChange: (filter: PaymentFilter) => void;
}

export const PaymentFilterChips: React.FC<PaymentFilterChipsProps> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by payment">
    {PAYMENT_FILTERS.map((filter) => {
      const active = filter.value === value;
      return (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          aria-pressed={active}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            active
              ? 'border-tapt-navy bg-tapt-navy text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {filter.label}
        </button>
      );
    })}
  </div>
);

export default PaymentFilterChips;
