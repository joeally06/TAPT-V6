import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SecureForm } from '../components/forms/SecureForm';

// Fallback defaults used when site_settings has no value
const DEFAULTS: Record<string, string> = {
  contact_email: 'contact@tapt.org',
  contact_phone: '615-406-9199',
  contact_address_line1: 'P.O. Box 700',
  contact_address_line2: '',
  contact_city: 'Portland',
  contact_state: 'TN',
  contact_zip: '37148',
  business_hours_days: 'Monday – Friday',
  business_hours_time: '8:00 AM – 4:30 PM CST',
};

const SETTING_KEYS = Object.keys(DEFAULTS);

export const Contact: React.FC = () => {
  const [contactInfo, setContactInfo] = useState<Record<string, string>>(DEFAULTS);
  const [contactLoaded, setContactLoaded] = useState(false);
  const [formState, setFormState] = useState({
    submitted: false,
    error: false,
    loading: false
  });

  // Convenient accessors
  const contactEmail = contactInfo.contact_email;
  const contactPhone = contactInfo.contact_phone;
  const contactAddressLine1 = contactInfo.contact_address_line1;
  const contactAddressLine2 = contactInfo.contact_address_line2;
  const contactCity = contactInfo.contact_city;
  const contactState = contactInfo.contact_state;
  const contactZip = contactInfo.contact_zip;
  const businessHoursDays = contactInfo.business_hours_days;
  const businessHoursTime = contactInfo.business_hours_time;

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const fetchSettings = async () => {
      try {
        // Single query to fetch all contact settings at once
        const { data, error } = await supabase
          .from('site_settings')
          .select('setting_key, setting_value')
          .in('setting_key', SETTING_KEYS);

        if (error) {
          console.error('Error fetching contact settings:', error);
          return; // DEFAULTS already applied via initial state
        }

        if (data && data.length > 0) {
          const fetched: Record<string, string> = {};
          for (const row of data) {
            fetched[row.setting_key] = row.setting_value ?? DEFAULTS[row.setting_key];
          }
          // Merge: fetched values override defaults
          setContactInfo(prev => ({ ...prev, ...fetched }));
        }
      } catch (error) {
        console.error('Error fetching contact settings:', error);
      } finally {
        setContactLoaded(true);
      }
    };

    fetchSettings();
  }, []);

  // Secure form submission handler
  const handleSecureSubmit = async (formData: any, isVerified: boolean, turnstileToken?: string) => {
    if (!isVerified) {
      throw new Error('Security verification required');
    }

    try {
      // Get the Supabase URL from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('SUPABASE_URL environment variable is not defined');
      }

      // Prepare the request payload
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        district: formData.district || undefined,
        message: formData.message,
        verified: isVerified, // Include verification status
        turnstileToken: turnstileToken // Include the Turnstile token for backend verification
      };

      // Make the request to the Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-contact-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });

      // Check if the request was successful
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit message');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit message');
      }

      setFormState({
        submitted: true,
        error: false,
        loading: false
      });
    } catch (error: any) {
      console.error('Error submitting message:', error);
      setFormState({
        error: true,
        loading: false,
        submitted: false
      });
      throw error; // Re-throw so SecureForm can handle it
    }
  };

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">Contact Us</h1>
            <p className="text-xl text-gray-200 mb-8 fade-in">Get in touch with the Tennessee Association of Pupil Transportation. We're here to help.</p>
          </div>
        </div>
      </section>

      {/* Contact Information & Form */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Contact Information */}
            <div>
              <h2 className="text-2xl font-bold text-secondary mb-6">Connect With Us</h2>
              
              <div className="space-y-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-primary/10 p-3 rounded-full">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-secondary">Mailing Address</h3>
                    <address className="mt-1 not-italic text-gray-600">
                      Tennessee Association of Pupil Transportation<br />
                      {contactAddressLine1}
                      {contactAddressLine2 && <><br />{contactAddressLine2}</>}
                      <br />{contactCity}, {contactState} {contactZip}
                    </address>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-primary/10 p-3 rounded-full">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-secondary">Phone</h3>
                    <p className="mt-1 text-gray-600">
                      <a href={`tel:+1${contactPhone.replace(/\D/g, '')}`} className="hover:text-primary transition-colors">{contactPhone}</a>
                    </p>
                    <div className="mt-1 text-gray-500 text-sm flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{businessHoursDays}, {businessHoursTime}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-primary/10 p-3 rounded-full">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-secondary">Email</h3>
                    <p className="mt-1 text-gray-600">
                      <a href={`mailto:${contactEmail}`} className="hover:text-primary transition-colors">{contactEmail}</a>
                    </p>
                    <p className="mt-1 text-gray-500 text-sm">
                      We'll respond as quickly as possible
                    </p>
                  </div>
                </div>
              </div>


            </div>

            {/* Contact Form */}
            <div>
              <h2 className="text-2xl font-bold text-secondary mb-6">Send Us a Message</h2>
              
              {formState.submitted ? (
                <div className="bg-green-50 border-l-4 border-green-500 p-6 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-green-800">Message Sent!</h3>
                      <div className="mt-2 text-green-700">
                        <p>Thank you for contacting TAPT. We've received your message and will respond shortly.</p>
                      </div>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => setFormState({
                            submitted: false,
                            error: false,
                            loading: false
                          })}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm leading-5 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:border-green-300 focus:shadow-outline-green active:bg-green-300 transition ease-in-out duration-150"
                        >
                          Send Another Message
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <SecureForm 
                  onSubmit={handleSecureSubmit}
                  className="space-y-6"
                  requireTurnstile={true}
                >
                  {formState.error && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">There was an error sending your message</h3>
                          <p className="mt-1 text-sm text-red-700">Please try again or contact us directly by phone.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Name Field */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>

                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>

                  {/* Phone Field */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>

                  {/* School District Field */}
                  <div>
                    <label htmlFor="district" className="block text-sm font-medium text-gray-700">School District/Organization</label>
                    <input
                      type="text"
                      id="district"
                      name="district"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    />
                  </div>

                  {/* Message Field */}
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={4}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                    ></textarea>
                  </div>
                </SecureForm>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;