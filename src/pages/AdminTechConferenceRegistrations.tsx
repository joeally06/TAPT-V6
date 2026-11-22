import React from 'react';
import {
  PaymentRegistrationsPage,
  type PaymentRegistration,
  type PaymentRegistrationsConfig
} from '../components/admin/PaymentRegistrationsPage';

// One meal ticket for each selected meal for each attendee
const mealTickets = (reg: PaymentRegistration): number =>
  reg.meal_selections ? reg.meal_selections.length * reg.total_attendees : 0;

const config: PaymentRegistrationsConfig = {
  type: 'tech_conference',
  table: 'tech_conference_registrations',
  attendeesTable: 'tech_conference_attendees',
  archiveType: 'tech-conference',
  title: 'Tech Conference Registrations',
  description: 'Manage and track tech conference registrations',
  filePrefix: 'tech-conference-registrations',
  searchColumns: ['school_district', 'first_name', 'last_name', 'email'],
  csvHeaders: [
    'Registration Date',
    'School District',
    'Primary Contact',
    'Email',
    'Phone',
    'Total Attendees',
    'Meal Tickets',
    'Total Amount',
    'Additional Attendees',
    'Payment Method',
    'Payment Status',
    'PO Number',
    'PayPal Transaction ID',
    'PayPal Payer Email',
    'Payment Completed At'
  ],
  csvRow: (reg: PaymentRegistration) => [
    new Date(reg.created_at).toLocaleDateString(),
    reg.school_district,
    `${reg.first_name} ${reg.last_name}`,
    reg.email,
    reg.phone,
    reg.total_attendees,
    mealTickets(reg),
    `$${(reg.total_amount || 0).toFixed(2)}`,
    reg.attendees ? reg.attendees.map((a) => `${a.first_name} ${a.last_name} (${a.email})`).join('; ') : '',
    reg.payment_method || '',
    reg.payment_status || '',
    reg.po_number || '',
    reg.paypal_transaction_id || '',
    reg.paypal_payer_email || '',
    reg.payment_completed_at ? new Date(reg.payment_completed_at).toLocaleString() : ''
  ],
  extraPaymentFields: (reg) => [{ label: 'Meal tickets', value: mealTickets(reg) }]
};

const AdminTechConferenceRegistrations: React.FC = () => <PaymentRegistrationsPage config={config} />;

export default AdminTechConferenceRegistrations;

export { AdminTechConferenceRegistrations };
