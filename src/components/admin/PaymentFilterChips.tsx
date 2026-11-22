import React from 'react';
import { PAYMENT_FILTERS, type PaymentFilter } from '../../lib/registrationPayments';
import { chipClass } from '../../lib/registrationList';

interface PaymentFilterChipsProps {
  value: PaymentFilter;
  onChange: (filter: PaymentFilter) => void;
}

export const PaymentFilterChips: React.FC<PaymentFilterChipsProps> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by payment">
    {PAYMENT_FILTERS.map((filter) => {
      const active = filter.value === value;
      return (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          aria-pressed={active}
          className={chipClass(active)}
        >
          {filter.label}
        </button>
      );
    })}
  </div>
);

export default PaymentFilterChips;
