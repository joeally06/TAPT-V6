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
  additionalAttendees?: Array<{
    firstName: string;
    lastName: string;
    email: string;
  }>;
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
  exhibitorOptions?: string[];
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
              <p style="margin: 0;">An invoice for $${data.totalAmount.toFixed(2)} will be sent to ${data.email} within 2 business days. Please reference PO# ${data.poNumber || 'N/A'} when making payment.</p>
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
          
          <p style="margin-top: 30px;">If you have any questions about your registration, please contact us at <a href="mailto:info@tapt.org" style="color: #1e3a8a;">info@tapt.org</a>.</p>
          
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
              <span class="label">Booth Size:</span> ${data.boothSize}
            </div>
            <div class="info-row">
              <span class="label">Total Amount:</span> <span class="total-amount">$${data.totalAmount.toFixed(2)}</span>
            </div>
          </div>
          
          ${optionsList}
          
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
              <p style="margin: 0;">An invoice for $${data.totalAmount.toFixed(2)} will be sent to ${data.email} within 2 business days. Please reference PO# ${data.poNumber || 'N/A'} when making payment.</p>
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
          
          <p style="margin-top: 30px;">If you have any questions about your exhibitor registration, please contact us at <a href="mailto:info@tapt.org" style="color: #1e3a8a;">info@tapt.org</a>.</p>
          
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
              <span class="label">Booth Size:</span> <strong>${data.boothSize}</strong>
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
