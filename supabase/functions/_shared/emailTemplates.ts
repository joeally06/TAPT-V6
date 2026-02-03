/**
 * Email template data interfaces
 */

export interface ConferenceRegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  schoolDistrict: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  totalAttendees: number;
  totalAmount: number;
  conferenceName: string;
  conferenceDate: string;
  conferenceLocation: string;
  paymentInstructions: string;
  paymentMethod?: 'po' | 'paypal';
  paymentStatus?: string;
  poNumber?: string;
  paypalTransactionId?: string;
  remittanceAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  additionalAttendees?: Array<{
    firstName: string;
    lastName: string;
    email: string;
  }>;
  // Billing contact fields (for invoices)
  billingFirstName?: string;
  billingLastName?: string;
  billingEmail?: string;
  registrantIsAttendee?: boolean;
}

export interface ExhibitorRegistrationData {
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  boothSize: string;
  totalAmount: number;
  conferenceName: string;
  conferenceDate: string;
  conferenceLocation: string;
  paymentInstructions: string;
  paymentMethod?: 'po' | 'paypal';
  paymentStatus?: string;
  poNumber?: string;
  paypalTransactionId?: string;
  remittanceAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  exhibitorOptions?: string[];
  participants?: Array<{
    firstName: string;
    lastName: string;
    role?: string | null;
  }>;
}

/**
 * Generate HTML email for user conference registration confirmation
 */
export function generateConferenceConfirmationEmail(data: ConferenceRegistrationData): string {
  const attendeesList = data.additionalAttendees && data.additionalAttendees.length > 0
    ? `
      <h3 style="color: #1e3a8a; margin-top: 20px;">Additional Attendees:</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        ${data.additionalAttendees.map(attendee => `
          <li style="margin: 5px 0;">${attendee.firstName} ${attendee.lastName} (${attendee.email})</li>
        `).join('')}
      </ul>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header { 
          background: #1e3a8a; 
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
        }
        .header p {
          margin: 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content { 
          padding: 30px 20px; 
        }
        .info-section {
          background: #f9fafb;
          padding: 20px;
          margin: 20px 0;
          border-radius: 8px;
          border-left: 4px solid #1e3a8a;
        }
        .info-row { 
          margin: 10px 0; 
        }
        .label { 
          font-weight: 600; 
          color: #1e3a8a; 
          display: inline-block;
          min-width: 140px;
        }
        .payment-box { 
          background: #fef3c7; 
          border-left: 4px solid #f59e0b; 
          padding: 20px; 
          margin: 20px 0; 
          border-radius: 4px;
        }
        .payment-box h3 {
          margin-top: 0;
          color: #92400e;
          font-size: 18px;
        }
        .footer { 
          text-align: center; 
          color: #6b7280; 
          font-size: 12px; 
          padding: 20px;
          border-top: 1px solid #e5e7eb;
        }
        .total-amount {
          font-size: 1.3em;
          color: #16a34a;
          font-weight: bold;
        }
        h3 {
          color: #1e3a8a;
          margin-top: 25px;
          margin-bottom: 15px;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Registration Confirmed</h1>
          <p>${data.conferenceName}</p>
        </div>
        
        <div class="content">
          <p>Dear ${data.firstName} ${data.lastName},</p>
          
          <p>Thank you for registering for the <strong>${data.conferenceName}</strong>! This email confirms your registration.</p>
          
          <div class="info-section">
            <h3 style="margin-top: 0;">Contact Information</h3>
            <div class="info-row">
              <span class="label">Organization:</span> ${data.schoolDistrict}
            </div>
            <div class="info-row">
              <span class="label">Primary Contact:</span> ${data.firstName} ${data.lastName}
            </div>
            <div class="info-row">
              <span class="label">Email:</span> ${data.email}
            </div>
            <div class="info-row">
              <span class="label">Phone:</span> ${data.phone}
            </div>
            <div class="info-row">
              <span class="label">Mailing Address:</span><br>
              <div style="margin-left: 140px; margin-top: 5px;">
                ${data.streetAddress}<br>
                ${data.city}, ${data.state} ${data.zipCode}
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <h3 style="margin-top: 0;">Conference Details</h3>
            <div class="info-row">
              <span class="label">Date:</span> ${data.conferenceDate}
            </div>
            <div class="info-row">
              <span class="label">Location:</span> ${data.conferenceLocation}
            </div>
          </div>
          
          <div class="info-section">
            <h3 style="margin-top: 0;">Registration Summary</h3>
            <div class="info-row">
              <span class="label">Total Attendees:</span> ${data.totalAttendees}
            </div>
            <div class="info-row">
              <span class="label">Total Amount:</span> <span class="total-amount">$${data.totalAmount.toFixed(2)}</span>
            </div>
          </div>
          
          ${attendeesList}
          
          ${data.paymentMethod ? `
            <div class="info-section">
              <h3 style="margin-top: 0;">Payment Information</h3>
              <div class="info-row">
                <span class="label">Payment Method:</span> ${data.paymentMethod === 'paypal' ? 'PayPal' : 'Purchase Order'}
              </div>
              ${data.paymentMethod === 'paypal' && data.paypalTransactionId ? `
                <div class="info-row">
                  <span class="label">Transaction ID:</span> ${data.paypalTransactionId}
                </div>
                <div class="info-row">
                  <span class="label">Payment Status:</span> <strong style="color: #16a34a;">✓ PAID</strong>
                </div>
              ` : ''}
              ${data.paymentMethod === 'po' && data.poNumber ? `
                <div class="info-row">
                  <span class="label">PO Number:</span> ${data.poNumber}
                </div>
                <div class="info-row">
                  <span class="label">Payment Status:</span> <strong style="color: #f59e0b;">⏳ Pending Invoice</strong>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          ${data.paymentMethod === 'po' ? `
            <div class="payment-box">
              <h3>📄 Invoice Information</h3>
              <p style="margin: 0;">Once your payment has been received, a receipt will be sent to ${data.email}. Please reference PO# ${data.poNumber || 'N/A'} when making payment.</p>
              ${data.remittanceAddress ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f59e0b;">
                  <p style="margin: 0 0 8px 0; font-weight: 600;">Send Payment To:</p>
                  <div style="white-space: pre-line; line-height: 1.5;">${data.remittanceAddress}</div>
                </div>
              ` : ''}
            </div>
          ` : data.paymentMethod === 'paypal' ? `
            <div class="payment-box" style="background: #d1fae5; border-left: 4px solid #10b981;">
              <h3 style="color: #065f46;">✓ Payment Confirmed</h3>
              <p style="margin: 0;">Your PayPal payment of $${data.totalAmount.toFixed(2)} has been successfully processed. No further action is required.</p>
            </div>
          ` : `
            <div class="payment-box">
              <h3>💳 Payment Instructions</h3>
              <p style="margin: 0;">${data.paymentInstructions}</p>
            </div>
          `}
          
          <p style="margin-top: 30px;">If you have any questions about your registration, please contact us at <a href="mailto:${data.contactEmail || 'info@tapt.org'}" style="color: #1e3a8a;">${data.contactEmail || 'info@tapt.org'}</a>${data.contactPhone ? ` or call ${data.contactPhone}` : ''}.</p>
          
          <p>We look forward to seeing you at the conference!</p>
          
          <p style="margin-top: 30px; margin-bottom: 0;">
            Best regards,<br>
            <strong>Tennessee Association of Pupil Transportation</strong>
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 5px 0;">This is an automated confirmation email. Please do not reply to this message.</p>
          <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} Tennessee Association of Pupil Transportation. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email for admin notification of new conference registration
 */
export function generateConferenceAdminNotification(data: ConferenceRegistrationData): string {
  const attendeesList = data.additionalAttendees && data.additionalAttendees.length > 0
    ? `
      <h3 style="color: #1e3a8a; margin-top: 20px;">Additional Attendees (${data.additionalAttendees.length}):</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        ${data.additionalAttendees.map(attendee => `
          <li style="margin: 5px 0;">${attendee.firstName} ${attendee.lastName} (${attendee.email})</li>
        `).join('')}
      </ul>
    `
    : '<p style="margin: 10px 0;"><em>No additional attendees</em></p>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
        }
        .content { 
          padding: 30px 20px; 
        }
        .highlight { 
          background: #dbeafe; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0;
          border-left: 4px solid #1e3a8a;
        }
        .info-row { 
          margin: 10px 0; 
        }
        .label { 
          font-weight: 600; 
          color: #1e3a8a; 
          display: inline-block;
          min-width: 140px;
        }
        .total-amount {
          font-size: 1.3em;
          color: #16a34a;
          font-weight: bold;
        }
        .button {
          display: inline-block;
          background: #1e3a8a;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 20px;
          font-weight: 600;
        }
        h3 {
          color: #1e3a8a;
          margin-top: 25px;
          margin-bottom: 15px;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 New Conference Registration</h1>
          <p>${data.conferenceName}</p>
        </div>
        
        <div class="content">
          <p style="font-size: 18px; font-weight: 600; margin-bottom: 20px;">A new registration has been submitted!</p>
          
          <div class="highlight">
            <div class="info-row">
              <span class="label">Organization:</span> <strong>${data.schoolDistrict}</strong>
            </div>
            <div class="info-row">
              <span class="label">Primary Contact:</span> ${data.firstName} ${data.lastName}
            </div>
            <div class="info-row">
              <span class="label">Total Attendees:</span> <strong>${data.totalAttendees}</strong>
            </div>
            <div class="info-row">
              <span class="label">Total Amount:</span> <span class="total-amount">$${data.totalAmount.toFixed(2)}</span>
            </div>
            ${data.paymentMethod ? `
              <div class="info-row">
                <span class="label">Payment Method:</span> <strong>${data.paymentMethod === 'paypal' ? '💳 PayPal' : '📄 Purchase Order'}</strong>
              </div>
              ${data.paymentMethod === 'paypal' ? `
                <div class="info-row">
                  <span class="label">Payment Status:</span> <strong style="color: #16a34a;">✓ PAID</strong>
                </div>
                ${data.paypalTransactionId ? `
                  <div class="info-row">
                    <span class="label">Transaction ID:</span> ${data.paypalTransactionId}
                  </div>
                ` : ''}
              ` : ''}
              ${data.paymentMethod === 'po' && data.poNumber ? `
                <div class="info-row">
                  <span class="label">PO Number:</span> <strong>${data.poNumber}</strong>
                </div>
                <div class="info-row">
                  <span class="label">Payment Status:</span> <strong style="color: #f59e0b;">⏳ Pending</strong>
                </div>
              ` : ''}
            ` : ''}
          </div>
          
          <h3>Contact Information</h3>
          <div class="info-row">
            <span class="label">Email:</span> <a href="mailto:${data.email}" style="color: #1e3a8a;">${data.email}</a>
          </div>
          <div class="info-row">
            <span class="label">Phone:</span> <a href="tel:${data.phone}" style="color: #1e3a8a;">${data.phone}</a>
          </div>
          <div class="info-row">
            <span class="label">Address:</span><br>
            <div style="margin-left: 140px; margin-top: 5px;">
              ${data.streetAddress}<br>
              ${data.city}, ${data.state} ${data.zipCode}
            </div>
          </div>
          
          ${attendeesList}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://tapt.org/admin/conference-registrations" class="button">
              View All Registrations
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email for user exhibitor registration confirmation
 */
export function generateExhibitorConfirmationEmail(data: ExhibitorRegistrationData): string {
  const optionsList = data.exhibitorOptions && data.exhibitorOptions.length > 0
    ? `
      <h3 style="color: #1e3a8a; margin-top: 20px;">Selected Options:</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        ${data.exhibitorOptions.map(option => `
          <li style="margin: 5px 0;">${option}</li>
        `).join('')}
      </ul>
    `
    : '';

  const participantsList = data.participants && data.participants.length > 0
    ? `
      <div class="info-section">
        <h3 style="margin-top: 0;">Additional Booth Participants</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${data.participants.map(p => `
            <li style="margin: 5px 0;">
              <strong>${p.firstName} ${p.lastName}</strong>${p.role ? ` - ${p.role}` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header { 
          background: #1e3a8a; 
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
        }
        .content { 
          padding: 30px 20px; 
        }
        .info-section {
          background: #f9fafb;
          padding: 20px;
          margin: 20px 0;
          border-radius: 8px;
          border-left: 4px solid #1e3a8a;
        }
        .info-row { 
          margin: 10px 0; 
        }
        .label { 
          font-weight: 600; 
          color: #1e3a8a; 
          display: inline-block;
          min-width: 140px;
        }
        .payment-box { 
          background: #fef3c7; 
          border-left: 4px solid #f59e0b; 
          padding: 20px; 
          margin: 20px 0; 
          border-radius: 4px;
        }
        .total-amount {
          font-size: 1.3em;
          color: #16a34a;
          font-weight: bold;
        }
        h3 {
          color: #1e3a8a;
          margin-top: 25px;
          margin-bottom: 15px;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Exhibitor Registration Confirmed</h1>
          <p>${data.conferenceName}</p>
        </div>
        
        <div class="content">
          <p>Dear ${data.contactFirstName} ${data.contactLastName},</p>
          
          <p>Thank you for registering as an exhibitor for the <strong>${data.conferenceName}</strong>! This email confirms your exhibitor registration.</p>
          
          <div class="info-section">
            <h3 style="margin-top: 0;">Company Information</h3>
            <div class="info-row">
              <span class="label">Company Name:</span> ${data.companyName}
            </div>
            <div class="info-row">
              <span class="label">Contact Person:</span> ${data.contactFirstName} ${data.contactLastName}
            </div>
            <div class="info-row">
              <span class="label">Email:</span> ${data.email}
            </div>
            <div class="info-row">
              <span class="label">Phone:</span> ${data.phone}
            </div>
            <div class="info-row">
              <span class="label">Address:</span><br>
              <div style="margin-left: 140px; margin-top: 5px;">
                ${data.streetAddress}<br>
                ${data.city}, ${data.state} ${data.zipCode}
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <h3 style="margin-top: 0;">Conference Details</h3>
            <div class="info-row">
              <span class="label">Date:</span> ${data.conferenceDate}
            </div>
            <div class="info-row">
              <span class="label">Location:</span> ${data.conferenceLocation}
            </div>
          </div>
          
          <div class="info-section">
            <h3 style="margin-top: 0;">Booth Details</h3>
            <div class="info-row">
              <span class="label">Booth Requirements:</span> ${data.boothSize}
            </div>
            <div class="info-row">
              <span class="label">Total Amount:</span> <span class="total-amount">$${data.totalAmount.toFixed(2)}</span>
            </div>
          </div>
          
          ${optionsList}
          
          ${participantsList}
          
          ${data.paymentMethod ? `
            <div class="info-section">
              <h3 style="margin-top: 0;">Payment Information</h3>
              <div class="info-row">
                <span class="label">Payment Method:</span> ${data.paymentMethod === 'paypal' ? 'PayPal' : 'Purchase Order'}
              </div>
              ${data.paymentMethod === 'paypal' && data.paypalTransactionId ? `
                <div class="info-row">
                  <span class="label">Transaction ID:</span> ${data.paypalTransactionId}
                </div>
                <div class="info-row">
                  <span class="label">Payment Status:</span> <strong style="color: #16a34a;">✓ PAID</strong>
                </div>
              ` : ''}
              ${data.paymentMethod === 'po' && data.poNumber ? `
                <div class="info-row">
                  <span class="label">PO Number:</span> ${data.poNumber}
                </div>
                <div class="info-row">
                  <span class="label">Payment Status:</span> <strong style="color: #f59e0b;">⏳ Pending Invoice</strong>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          ${data.paymentMethod === 'po' ? `
            <div class="payment-box">
              <h3>📄 Invoice Information</h3>
              <p style="margin: 0;">Once your payment has been received, a receipt will be sent to ${data.email}. Please reference PO# ${data.poNumber || 'N/A'} when making payment.</p>
              ${data.remittanceAddress ? `
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f59e0b;">
                  <p style="margin: 0 0 8px 0; font-weight: 600;">Send Payment To:</p>
                  <div style="white-space: pre-line; line-height: 1.5;">${data.remittanceAddress}</div>
                </div>
              ` : ''}
            </div>
          ` : data.paymentMethod === 'paypal' ? `
            <div class="payment-box" style="background: #d1fae5; border-left: 4px solid #10b981;">
              <h3 style="color: #065f46;">✓ Payment Confirmed</h3>
              <p style="margin: 0;">Your PayPal payment of $${data.totalAmount.toFixed(2)} has been successfully processed. No further action is required.</p>
            </div>
          ` : `
            <div class="payment-box">
              <h3>💳 Payment Instructions</h3>
              <p style="margin: 0;">${data.paymentInstructions}</p>
            </div>
          `}
          
          <p style="margin-top: 30px;">If you have any questions about your exhibitor registration, please contact us at <a href="mailto:${data.contactEmail || 'info@tapt.org'}" style="color: #1e3a8a;">${data.contactEmail || 'info@tapt.org'}</a>${data.contactPhone ? ` or call ${data.contactPhone}` : ''}.</p>
          
          <p>We look forward to having you as an exhibitor!</p>
          
          <p style="margin-top: 30px; margin-bottom: 0;">
            Best regards,<br>
            <strong>Tennessee Association of Pupil Transportation</strong>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email for admin notification of new exhibitor registration
 */
export function generateExhibitorAdminNotification(data: ExhibitorRegistrationData): string {
  const optionsList = data.exhibitorOptions && data.exhibitorOptions.length > 0
    ? `
      <h3 style="color: #1e3a8a; margin-top: 20px;">Selected Options:</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        ${data.exhibitorOptions.map(option => `
          <li style="margin: 5px 0;">${option}</li>
        `).join('')}
      </ul>
    `
    : '<p style="margin: 10px 0;"><em>No additional options selected</em></p>';

  const participantsList = data.participants && data.participants.length > 0
    ? `
      <h3 style="color: #1e3a8a; margin-top: 20px;">Additional Booth Participants (${data.participants.length}):</h3>
      <ul style="margin: 10px 0; padding-left: 20px;">
        ${data.participants.map(p => `
          <li style="margin: 5px 0;">
            <strong>${p.firstName} ${p.lastName}</strong>${p.role ? ` - ${p.role}` : ''}
          </li>
        `).join('')}
      </ul>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .content { 
          padding: 30px 20px; 
        }
        .highlight { 
          background: #dbeafe; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0;
          border-left: 4px solid #1e3a8a;
        }
        .info-row { 
          margin: 10px 0; 
        }
        .label { 
          font-weight: 600; 
          color: #1e3a8a; 
          display: inline-block;
          min-width: 140px;
        }
        .total-amount {
          font-size: 1.3em;
          color: #16a34a;
          font-weight: bold;
        }
        .button {
          display: inline-block;
          background: #1e3a8a;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 20px;
          font-weight: 600;
        }
        h3 {
          color: #1e3a8a;
          margin-top: 25px;
          margin-bottom: 15px;
          font-size: 18px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏢 New Exhibitor Registration</h1>
          <p>${data.conferenceName}</p>
        </div>
        
        <div class="content">
          <p style="font-size: 18px; font-weight: 600; margin-bottom: 20px;">A new exhibitor registration has been submitted!</p>
          
          <div class="highlight">
            <div class="info-row">
              <span class="label">Company:</span> <strong>${data.companyName}</strong>
            </div>
            <div class="info-row">
              <span class="label">Contact:</span> ${data.contactFirstName} ${data.contactLastName}
            </div>
            <div class="info-row">
              <span class="label">Booth Requirements:</span> <strong>${data.boothSize}</strong>
            </div>
            <div class="info-row">
              <span class="label">Total Amount:</span> <span class="total-amount">$${data.totalAmount.toFixed(2)}</span>
            </div>
            ${data.paymentMethod ? `
              <div class="info-row">
                <span class="label">Payment Method:</span> <strong>${data.paymentMethod === 'paypal' ? '💳 PayPal' : '📄 Purchase Order'}</strong>
              </div>
              ${data.paymentMethod === 'paypal' ? `
                <div class="info-row">
                  <span class="label">Payment Status:</span> <strong style="color: #16a34a;">✓ PAID</strong>
                </div>
                ${data.paypalTransactionId ? `
                  <div class="info-row">
                    <span class="label">Transaction ID:</span> ${data.paypalTransactionId}
                  </div>
                ` : ''}
              ` : ''}
              ${data.paymentMethod === 'po' && data.poNumber ? `
                <div class="info-row">
                  <span class="label">PO Number:</span> <strong>${data.poNumber}</strong>
                </div>
                <div class="info-row">
                  <span class="label">Payment Status:</span> <strong style="color: #f59e0b;">⏳ Pending</strong>
                </div>
              ` : ''}
            ` : ''}
          </div>
          
          <h3>Contact Information</h3>
          <div class="info-row">
            <span class="label">Email:</span> <a href="mailto:${data.email}" style="color: #1e3a8a;">${data.email}</a>
          </div>
          <div class="info-row">
            <span class="label">Phone:</span> <a href="tel:${data.phone}" style="color: #1e3a8a;">${data.phone}</a>
          </div>
          <div class="info-row">
            <span class="label">Address:</span><br>
            <div style="margin-left: 140px; margin-top: 5px;">
              ${data.streetAddress}<br>
              ${data.city}, ${data.state} ${data.zipCode}
            </div>
          </div>
          
          ${optionsList}
          
          ${participantsList}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://tapt.org/admin/exhibitor-registrations" class="button">
              View All Exhibitor Registrations
            </a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Payment Receipt Email Data Interface
 */
export interface PaymentReceiptData {
  registrationType: 'conference' | 'tech_conference' | 'exhibitor';
  firstName: string;
  lastName: string;
  email: string;
  schoolDistrict?: string;
  businessName?: string;
  poNumber: string;
  totalAmount: number;
  paymentCompletedAt: string;
  conferenceName?: string;
  conferenceDate?: string;
  // Dynamic settings
  remittanceAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  organizationName?: string;
  footerMessage?: string;
}

export interface RegionalLuncheonRegistrationData {
  name: string;
  email: string;
  districtOrganization: string;
  numberOfAttendees: number;
  preferredRegion: string;
  eventName: string;
  registrationDeadline: string;
  regionalDate?: string;
  regionalTime?: string;
  regionalVenue?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/**
 * Generate HTML email for payment receipt/confirmation
 */
export function generatePaymentReceiptEmail(data: PaymentReceiptData): string {
  const registrationTypeLabel = data.registrationType === 'conference' 
    ? 'Annual Conference Registration'
    : data.registrationType === 'tech_conference'
    ? 'Tech Conference Registration'
    : 'Exhibitor Registration';

  const organizationName = data.schoolDistrict || data.businessName || 'N/A';
  
  // Parse date and format for US Central timezone to avoid timezone shift issues
  // The payment_completed_at is stored as UTC, so we format it explicitly for display
  const paymentDateTime = new Date(data.paymentCompletedAt);
  const paymentDate = paymentDateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago' // Use Central Time for Tennessee
  });

  // Use provided settings or fallback to defaults
  const contactEmail = data.contactEmail || 'info@tapt.org';
  const contactPhone = data.contactPhone || '(615) 555-0100';
  const orgName = data.organizationName || 'Tennessee Association of Pupil Transportation';
  const footerMsg = data.footerMessage || 'This is an automated receipt email. Please keep it for your records.';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white; 
          padding: 40px 20px; 
          text-align: center; 
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .header .checkmark {
          font-size: 60px;
          margin-bottom: 10px;
        }
        .content { 
          padding: 30px 20px; 
        }
        .receipt-box {
          background: #f9fafb;
          border: 2px solid #10b981;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .receipt-box h2 {
          margin: 0 0 20px 0;
          color: #065f46;
          font-size: 20px;
        }
        .info-row { 
          padding: 12px 0; 
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .label { 
          font-weight: 600; 
          color: #4b5563;
          min-width: 140px;
        }
        .value {
          color: #111827;
          text-align: right;
        }
        .amount-row {
          background: #ecfdf5;
          margin: 20px -20px -20px -20px;
          padding: 20px;
          border-top: 2px solid #10b981;
        }
        .total-amount { 
          font-size: 32px;
          font-weight: bold; 
          color: #059669;
        }
        .paid-stamp {
          background: #10b981;
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .footer { 
          background: #f9fafb; 
          padding: 20px; 
          text-align: center; 
          font-size: 12px; 
          color: #6b7280; 
          border-top: 1px solid #e5e7eb;
        }
        .button {
          display: inline-block;
          background: #1e3a8a;
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 20px 0;
        }
        .info-box {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="checkmark">✓</div>
          <h1>Payment Received!</h1>
          <p style="margin: 0; font-size: 16px; opacity: 0.95;">Your purchase order payment has been processed</p>
        </div>
        
        <div class="content">
          <p>Dear ${data.firstName} ${data.lastName},</p>
          
          <p>We are pleased to confirm that we have received and processed your purchase order payment for your <strong>${registrationTypeLabel}</strong>.</p>
          
          <div class="receipt-box">
            <h2>📄 Payment Receipt</h2>
            
            <div class="info-row">
              <span class="label">Receipt Date:</span>
              <span class="value">${paymentDate}</span>
            </div>
            
            <div class="info-row">
              <span class="label">Registration Type:</span>
              <span class="value">${registrationTypeLabel}</span>
            </div>
            
            <div class="info-row">
              <span class="label">Name:</span>
              <span class="value">${data.firstName} ${data.lastName}</span>
            </div>
            
            <div class="info-row">
              <span class="label">Organization:</span>
              <span class="value">${organizationName}</span>
            </div>
            
            <div class="info-row">
              <span class="label">PO Number:</span>
              <span class="value"><strong>${data.poNumber}</strong></span>
            </div>
            
            <div class="info-row">
              <span class="label">Payment Method:</span>
              <span class="value">Purchase Order</span>
            </div>
            
            <div class="info-row">
              <span class="label">Payment Status:</span>
              <span class="value"><span class="paid-stamp">✓ Paid</span></span>
            </div>
            
            <div class="amount-row">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="label" style="font-size: 18px;">Amount Paid:</span>
                <span class="total-amount">$${data.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          ${data.conferenceName ? `
            <div class="info-box">
              <h3 style="margin: 0 0 10px 0; color: #1e40af;">Event Details</h3>
              <p style="margin: 5px 0;"><strong>Event:</strong> ${data.conferenceName}</p>
              ${data.conferenceDate ? `<p style="margin: 5px 0;"><strong>Date:</strong> ${data.conferenceDate}</p>` : ''}
            </div>
          ` : ''}
          
          <p><strong>Please keep this email for your records.</strong> This serves as your official payment receipt.</p>
          
          ${data.remittanceAddress ? `
            <div class="info-box">
              <h3 style="margin: 0 0 10px 0; color: #1e40af;">Remittance Address</h3>
              <div style="white-space: pre-line;">${data.remittanceAddress}</div>
            </div>
          ` : ''}
          
          <p>If you have any questions about your payment or registration, please don't hesitate to contact us at <a href="mailto:${contactEmail}" style="color: #1e3a8a;">${contactEmail}</a> or call us at ${contactPhone}.</p>
          
          <p>Thank you for your payment!</p>
          
          <p style="margin-top: 30px; margin-bottom: 0;">
            Best regards,<br>
            <strong>${orgName}</strong><br>
            ${contactEmail || 'contact@tapt.org'}
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate HTML email for regional luncheon registration confirmation
 */
export function generateRegionalLuncheonConfirmationEmail(data: RegionalLuncheonRegistrationData): string {
  const orgName = 'Tennessee Association of Pupil Transportation';
  const footerMsg = 'This is an automated confirmation email. Please keep it for your records.';
  
  // Format registration deadline to human-readable format
  let formattedDeadline = data.registrationDeadline;
  if (formattedDeadline && formattedDeadline !== 'TBD') {
    try {
      // Parse the date string to avoid timezone issues
      const dateStr = formattedDeadline.split('T')[0];
      const [year, month, day] = dateStr.split('-');
      const deadlineDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      formattedDeadline = deadlineDate.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (e) {
      // Keep original format if parsing fails
    }
  }
  
  const regionalInfo = data.regionalDate && data.regionalTime
    ? `
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <h3 style="color: #1e3a8a; margin-top: 0;">Your Selected Regional Luncheon:</h3>
        <p style="margin: 5px 0;"><strong>Region:</strong> ${data.preferredRegion}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${data.regionalDate}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${data.regionalTime}</p>
        ${data.regionalVenue ? `<p style="margin: 5px 0;"><strong>Venue:</strong> ${data.regionalVenue}</p>` : ''}
        <p style="margin: 5px 0;"><strong>Number of Attendees:</strong> ${data.numberOfAttendees}</p>
      </div>
    `
    : `
      <p style="background-color: #f3f4f6; padding: 15px; border-radius: 6px;">
        <strong>Region:</strong> ${data.preferredRegion}<br>
        <strong>Number of Attendees:</strong> ${data.numberOfAttendees}
      </p>
    `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header { 
          background: #1e3a8a; 
          color: white; 
          padding: 30px 20px;
          text-align: center;
        }
        .content { 
          padding: 30px 20px; 
        }
        .footer { 
          background: #f9fafb; 
          padding: 20px;
          text-align: center;
          font-size: 14px;
          color: #6b7280;
          border-top: 1px solid #e5e7eb;
        }
        h1 { 
          margin: 0; 
          font-size: 24px; 
        }
        h2 {
          color: #1e3a8a;
          font-size: 20px;
          margin-top: 30px;
        }
        .highlight {
          background-color: #fef3c7;
          padding: 15px;
          border-left: 4px solid #f59e0b;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Registration Confirmed!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${data.eventName}</p>
        </div>
        
        <div class="content">
          <p>Dear ${data.name},</p>
          
          <p>Thank you for registering for the <strong>${data.eventName}</strong>! We're excited to have you join us for this great opportunity for learning, networking, and collaboration with transportation professionals across the state.</p>
          
          ${regionalInfo}
          
          <h2>Registration Details:</h2>
          <p style="margin: 10px 0;">
            <strong>Name:</strong> ${data.name}<br>
            <strong>Email:</strong> ${data.email}<br>
            <strong>District/Organization:</strong> ${data.districtOrganization}
          </p>
          
          <div class="highlight">
            <p style="margin: 0;"><strong>⏰ Registration Deadline:</strong> ${formattedDeadline}</p>
            <p style="margin: 10px 0 0 0; font-size: 14px;">
              Please note this deadline so we can plan accordingly for food and seating.
            </p>
          </div>
          
          <h2>What to Expect:</h2>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Enjoy a great meal and fellowship</li>
            <li>Share ideas and best practices</li>
            <li>Learn from peers and industry leaders</li>
            <li>Help strengthen our statewide transportation network</li>
          </ul>
          
          <p style="background-color: #eff6ff; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
            <strong>📧 Keep this email</strong> for your records. If you have any questions or need to make changes to your registration, please contact us.
          </p>
          
          <p>We look forward to seeing you there!</p>
          
          <p style="margin-top: 30px; margin-bottom: 0;">
            Best regards,<br>
            <strong>Tennessee Association of Pupil Transportation (TAPT)</strong><br>
            <a href="https://tapt.org" style="color: #1e3a8a;">www.tapt.org</a>
          </p>
        </div>
        
        <div class="footer">
          <p style="margin: 5px 0;">${footerMsg}</p>
          <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} ${orgName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

