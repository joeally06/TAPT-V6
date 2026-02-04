import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { sanitizeObject, type SanitizationRule } from '../_shared/sanitize.ts';
import { sendEmail } from '../_shared/email.ts';

const allowedOrigins = [
  'https://tapt.org',
  'https://www.tapt.org',
  'https://tntapt.com',
  'https://www.tntapt.com',
  'https://admin.tapt.org',
  'http://localhost:5173',
  'https://localhost:5173',
  // Add WebContainer domains
  'https://*.webcontainer-api.io',
  'http://*.webcontainer-api.io'
];

// Valid regions - used for validation
const VALID_REGIONS = ['West Region', 'Middle Region', 'Cookeville Region', 'Greeneville Region', 'East Region'];
const MAX_REGIONS = 10; // Safety limit

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'"
};

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') || '';
  // Check if origin matches any allowed pattern (including wildcards)
  const allowOrigin = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`).test(origin);
    }
    return allowed === origin;
  }) ? origin : '';
  
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

    const body = await req.json();
    console.log('📝 Received regional luncheon registration data:', {
      ...body,
      turnstileToken: body.turnstileToken ? `Token present (${body.turnstileToken.length} chars)` : 'MISSING'
    });
    
    // Verify Turnstile token
    if (!body.turnstileToken) {
      console.error('❌ Missing Turnstile token');
      return new Response(
        JSON.stringify({ error: 'Security verification required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!turnstileSecret) {
      console.error('❌ Turnstile secret key not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify Turnstile token with Cloudflare
    const turnstileResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: body.turnstileToken,
          remoteip: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For')
        })
      }
    );

    const turnstileResult = await turnstileResponse.json();
    console.log('🔒 Turnstile verification result:', turnstileResult);

    if (!turnstileResult.success) {
      console.error('❌ Turnstile verification failed:', turnstileResult);
      return new Response(
        JSON.stringify({ 
          error: 'Security verification failed. Please try again.',
          details: turnstileResult['error-codes']
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ Turnstile verification successful');
    
    // Define sanitization schema for base fields (excluding selectedRegions which we validate separately)
    const registrationSchema: Record<string, SanitizationRule> = {
      name: { type: 'string', required: true, maxLength: 200 },
      email: { type: 'email', required: true, maxLength: 255 },
      districtOrganization: { type: 'string', required: true, maxLength: 200 },
      numberOfAttendees: { type: 'number', required: true, min: 1, max: 3 },
      eventId: { type: 'string', required: false, maxLength: 100 }
    };

    console.log('🧹 Sanitizing registration data...');
    const sanitizedData = sanitizeObject(body, registrationSchema);
    console.log('✅ Data sanitized:', { ...sanitizedData, email: sanitizedData.email ? '[REDACTED]' : undefined });

    // Validate selectedRegions array separately for security
    const selectedRegions = body.selectedRegions;
    if (!selectedRegions || !Array.isArray(selectedRegions) || selectedRegions.length === 0) {
      console.error('❌ Invalid selectedRegions: must be a non-empty array');
      return new Response(
        JSON.stringify({ error: 'Please select at least one region to attend' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Limit max regions to prevent abuse
    if (selectedRegions.length > MAX_REGIONS) {
      console.error('❌ Too many regions selected:', selectedRegions.length);
      return new Response(
        JSON.stringify({ error: 'Too many regions selected' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate each region is a valid string and in allowed list
    const validatedRegions: string[] = [];
    for (const region of selectedRegions) {
      if (typeof region !== 'string') {
        console.error('❌ Invalid region type:', typeof region);
        return new Response(
          JSON.stringify({ error: 'Invalid region format' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      const trimmedRegion = region.trim();
      if (!VALID_REGIONS.includes(trimmedRegion)) {
        console.error('❌ Invalid region value:', trimmedRegion);
        return new Response(
          JSON.stringify({ error: `Invalid region: ${trimmedRegion}` }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Avoid duplicates
      if (!validatedRegions.includes(trimmedRegion)) {
        validatedRegions.push(trimmedRegion);
      }
    }

    console.log('✅ Validated regions:', validatedRegions);

    // Check for existing registration with same email and event (prevent duplicates)
    if (sanitizedData.eventId) {
      const { data: existingRegistration, error: checkError } = await supabaseAdmin
        .from('regional_luncheon_registrations')
        .select('id, selected_regions, email')
        .eq('email', sanitizedData.email)
        .eq('event_id', sanitizedData.eventId)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Error checking for existing registration:', checkError);
        // Continue with registration - don't block on check failure
      } else if (existingRegistration) {
        console.warn('⚠️ Duplicate registration attempt:', { email: '[REDACTED]', eventId: sanitizedData.eventId });
        return new Response(
          JSON.stringify({ 
            error: 'You have already registered for this event. Please contact us if you need to update your registration.',
            existingRegistrationId: existingRegistration.id
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    console.log(`📝 Creating single registration with ${validatedRegions.length} region(s)`);

    // Insert SINGLE registration row with selected_regions as JSONB array
    const { data: insertedRegistration, error: insertError } = await supabaseAdmin
      .from('regional_luncheon_registrations')
      .insert({
        name: sanitizedData.name,
        email: sanitizedData.email,
        district_organization: sanitizedData.districtOrganization,
        number_of_attendees: sanitizedData.numberOfAttendees,
        selected_regions: validatedRegions,  // JSONB array of all selected regions
        preferred_region: validatedRegions[0],  // Keep first region for backward compatibility
        event_id: sanitizedData.eventId || null
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to save registration. Please try again.',
          details: insertError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ Successfully created registration ID: ${insertedRegistration.id} for ${validatedRegions.length} region(s)`);

    // Fetch event settings to get event details and regional dates
    let eventSettings = null;
    if (sanitizedData.eventId) {
      const { data, error } = await supabaseAdmin
        .from('regional_luncheon_settings')
        .select('*')
        .eq('id', sanitizedData.eventId)
        .eq('is_active', true)
        .single();
      
      if (!error && data) {
        eventSettings = data;
        console.log('📅 Event settings retrieved:', { id: data.id, event_name: data.event_name });
      } else {
        console.warn('⚠️ Could not retrieve event settings:', error?.message);
      }
    }

    // Send confirmation email with all registered regions
    try {
      console.log('📧 Preparing confirmation email...');
      
      // Build regional info for email
      const regionalInfoList: Array<{region: string, date: string, time: string, venue: string}> = [];
      
      if (eventSettings?.regional_dates) {
        const regionalDates = Array.isArray(eventSettings.regional_dates) 
          ? eventSettings.regional_dates 
          : [];
        
        for (const region of validatedRegions) {
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
      }

      const eventName = eventSettings?.event_name || 'TAPT Regional Luncheon';
      const registrationDeadline = eventSettings?.registration_deadline || 'TBD';
      
      // Generate email HTML for multi-region registration
      const emailHtml = generateMultiRegionConfirmationEmail({
        name: sanitizedData.name,
        email: sanitizedData.email,
        districtOrganization: sanitizedData.districtOrganization,
        numberOfAttendees: sanitizedData.numberOfAttendees,
        selectedRegions: validatedRegions,
        regionalInfo: regionalInfoList,
        eventName,
        registrationDeadline,
        registrationId: insertedRegistration.id
      });
      
      await sendEmail({
        to: sanitizedData.email,
        subject: `Registration Confirmed - ${eventName}${validatedRegions.length > 1 ? ` (${validatedRegions.length} events)` : ''}`,
        html: emailHtml
      });

      console.log('✅ Confirmation email sent successfully');
    } catch (emailError) {
      // Log email error but don't fail the registration
      console.error('❌ Failed to send confirmation email:', emailError);
      console.log('⚠️ Registration was saved but email failed - user may need manual notification');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Registration submitted successfully for ${validatedRegions.length} regional luncheon${validatedRegions.length > 1 ? 's' : ''}!`,
        registrationId: insertedRegistration.id,
        registeredRegions: validatedRegions,
        count: validatedRegions.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Error processing regional luncheon registration:', error);
    
    // Sanitize error message
    const errorMessage = error instanceof Error 
      ? error.message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
      : 'An unexpected error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process registration',
        message: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
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
