import React from 'react';
import {
  PaymentRegistrationsPage,
  type PaymentRegistration,
  type PaymentRegistrationsConfig
} from '../components/admin/PaymentRegistrationsPage';

const config: PaymentRegistrationsConfig = {
  type: 'conference',
  table: 'conference_registrations',
  attendeesTable: 'conference_attendees',
  archiveType: 'conference',
  title: 'Conference Registrations',
  description: 'Manage and track conference registrations',
  filePrefix: 'conference-registrations',
  searchColumns: ['first_name', 'last_name', 'email', 'school_district'],
  csvHeaders: [
    'Registration Date',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'School District',
    'Job Title',
    'Total Attendees',
    'Total Amount',
    'Payment Method',
    'Payment Status',
    'PO Number',
    'PayPal Transaction ID',
    'PayPal Payer Email',
    'Payment Completed At',
    'Additional Attendees'
  ],
  csvRow: (reg: PaymentRegistration) => [
    new Date(reg.created_at).toLocaleDateString(),
    reg.first_name || '',
    reg.last_name || '',
    reg.email || '',
    reg.phone || '',
    reg.school_district || '',
    reg.job_title || '',
    reg.total_attendees || 0,
    `$${(reg.total_amount || 0).toFixed(2)}`,
    reg.payment_method || '',
    reg.payment_status || '',
    reg.po_number || '',
    reg.paypal_transaction_id || '',
    reg.paypal_payer_email || '',
    reg.payment_completed_at ? new Date(reg.payment_completed_at).toLocaleString() : '',
    reg.attendees ? reg.attendees.map((a) => `${a.first_name} ${a.last_name} (${a.email})`).join('; ') : ''
  ],
  extraContactFields: (reg) => [{ label: 'Job title', value: reg.job_title || 'N/A' }]
};

const AdminConferenceRegistrations: React.FC = () => <PaymentRegistrationsPage config={config} />;

export default AdminConferenceRegistrations;

export { AdminConferenceRegistrations };
