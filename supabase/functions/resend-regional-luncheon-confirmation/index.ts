import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/email.ts';

const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
  'https://admin.tapt.org',
  'http://localhost:5173',
  'https://localhost:5173',
];

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'"
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  const allowOrigin = allowedOrigins.includes(origin) ? origin : '';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...securityHeaders
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed');
    }

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin by querying users table directly (service role bypasses RLS)
    const { data: userData, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !userData || userData.role !== 'admin') {
      console.error('User is not admin:', { userData, roleError });
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { registrationId } = body;

    if (!registrationId) {
      return new Response(
        JSON.stringify({ error: 'Registration ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the registration
    const { data: registration, error: regError } = await supabaseAdmin
      .from('regional_luncheon_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      console.error('Registration not found:', regError);
      return new Response(
        JSON.stringify({ error: 'Registration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📧 Resending confirmation email for registration:', registrationId);

    // Get event settings if available
    let eventSettings = null;
    if (registration.event_id) {
      const { data } = await supabaseAdmin
        .from('regional_luncheon_settings')
        .select('*')
        .eq('id', registration.event_id)
        .single();
      eventSettings = data;
    }

    // Get selected regions (from JSONB array or fallback to preferred_region)
    const selectedRegions: string[] = registration.selected_regions && Array.isArray(registration.selected_regions) && registration.selected_regions.length > 0
      ? registration.selected_regions
      : registration.preferred_region ? [registration.preferred_region] : [];

    if (selectedRegions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No regions found for this registration' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build regional info for email
    const regionalInfoList: Array<{region: string, date: string, time: string, venue: string}> = [];
    
    if (eventSettings?.regional_dates) {
      const regionalDates = Array.isArray(eventSettings.regional_dates) 
        ? eventSettings.regional_dates 
        : [];
      
      for (const region of selectedRegions) {
        const matchingRegion = regionalDates.find(
          (r: any) => r.region === region
        );
        
        if (matchingRegion) {
          regionalInfoList.push({
            region,
            date: matchingRegion.date || '',
            time: matchingRegion.time || '',
            venue: matchingRegion.venue || ''
          });
        } else {
          regionalInfoList.push({
            region,
            date: 'TBD',
            time: 'TBD',
            venue: 'TBD'
          });
        }
      }
    } else {
      // No event settings, just list regions without dates
      for (const region of selectedRegions) {
        regionalInfoList.push({
          region,
          date: 'TBD',
          time: 'TBD',
          venue: 'TBD'
        });
      }
    }

    const eventName = eventSettings?.event_name || eventSettings?.name || 'TAPT Regional Luncheon';

    // Generate email HTML
    const emailHtml = generateMultiRegionConfirmationEmail({
      name: registration.name,
      email: registration.email,
      districtOrganization: registration.district_organization,
      numberOfAttendees: registration.number_of_attendees,
      selectedRegions,
      regionalInfo: regionalInfoList,
      eventName,
      registrationDeadline: eventSettings?.registration_deadline || 'TBD',
      registrationId: registration.id
    });

    // Send the email
    const emailResult = await sendEmail({
      to: registration.email,
      subject: `Registration Confirmed - ${eventName}${selectedRegions.length > 1 ? ` (${selectedRegions.length} events)` : ''}`,
      html: emailHtml
    });

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return new Response(
        JSON.stringify({ error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Confirmation email resent successfully to:', registration.email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Confirmation email sent to ${registration.email}` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error resending confirmation email:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to resend confirmation email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to generate multi-region confirmation email
interface MultiRegionEmailData {
  name: string;
  email: string;
  districtOrganization: string;
  numberOfAttendees: number;
  selectedRegions: string[];
  regionalInfo: Array<{region: string, date: string, time: string, venue: string}>;
  eventName: string;
  registrationDeadline: string;
  registrationId: string;
}

function generateMultiRegionConfirmationEmail(data: MultiRegionEmailData): string {
  const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr || dateStr === 'TBD') return 'TBD';
    try {
      const [year, month, day] = dateStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const regionCount = data.selectedRegions.length;
  const isMultiple = regionCount > 1;

  const regionalListHtml = data.regionalInfo.map(info => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong style="color: #1e40af;">${info.region}</strong><br>
        <span style="color: #6b7280; font-size: 14px;">
          ${formatDateForDisplay(info.date)} at ${info.time || 'TBD'}<br>
          ${info.venue ? `<em>${info.venue}</em>` : 'Venue TBD'}
        </span>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px 40px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                Registration Confirmed! ✓
              </h1>
              <p style="margin: 10px 0 0 0; color: #bfdbfe; font-size: 16px;">
                ${data.eventName}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Dear <strong>${data.name}</strong>,
              </p>
              <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Thank you for registering for the ${data.eventName}! ${isMultiple ? `You have successfully registered for <strong>${regionCount} regional luncheons</strong>.` : 'Your registration has been confirmed.'}
              </p>

              <!-- Registration Details -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">Registration Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Name:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${data.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Organization:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${data.districtOrganization}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Attendees:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${data.numberOfAttendees} ${data.numberOfAttendees > 1 ? 'people' : 'person'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Confirmation #:</td>
                    <td style="padding: 8px 0; color: #1f2937; font-size: 12px; font-family: monospace;">${data.registrationId.substring(0, 8).toUpperCase()}</td>
                  </tr>
                </table>
              </div>

              <!-- Registered Events -->
              <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px;">
                  ${isMultiple ? 'Your Registered Events' : 'Event Details'}
                </h2>
                <table style="width: 100%; border-collapse: collapse; background-color: #eff6ff; border-radius: 8px;">
                  ${regionalListHtml}
                </table>
              </div>

              <!-- Important Notes -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 30px;">
                <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 14px;">Important Reminders</h3>
                <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <li>Please arrive 15 minutes early to check in</li>
                  <li>Bring this email as confirmation</li>
                  ${isMultiple ? '<li>Your registration applies to all events listed above</li>' : ''}
                  <li>Contact us if you need to make changes</li>
                </ul>
              </div>

              <p style="margin: 0; color: #374151; font-size: 16px; line-height: 1.6;">
                We look forward to seeing you!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                Tennessee Association of Pupil Transportation
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                If you have questions, please contact us at <a href="mailto:info@tapt.org" style="color: #3b82f6;">info@tapt.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
