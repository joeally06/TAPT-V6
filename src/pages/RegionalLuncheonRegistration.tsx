import React, { useState, useEffect } from 'react';
import { MapPin, Users, Building, User, Calendar, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { SecureForm } from '../components/forms/SecureForm';
import { supabase } from '../lib/supabase';

interface RegionalDate {
  region: string;
  date: string;
  time: string;
  venue: string;
}

interface RegionalLuncheonSettings {
  id: string;
  name: string;
  registration_deadline: string;
  description: string;
  regional_dates: RegionalDate[];
  is_active: boolean;
}

const regionalLuncheons = [
  { id: 'West Region', name: 'West Region', date: 'April 2, 2026', time: '10:30 AM CST' },
  { id: 'Middle Region', name: 'Middle Region', date: 'April 10, 2026', time: '10:30 AM CST' },
  { id: 'Cookeville Region', name: 'Cookeville Region', date: 'April 17, 2026', time: '10:30 AM CST' },
  { id: 'Greeneville Region', name: 'Greeneville Region', date: 'April 23, 2026', time: '10:30 AM EST' },
  { id: 'East Region', name: 'East Region', date: 'April 24, 2026', time: '10:30 AM EST' },
];

const RegionalLuncheonRegistration: React.FC = () => {
  const [settings, setSettings] = useState<RegionalLuncheonSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    districtOrganization: '',
    numberOfAttendees: 1,
    preferredRegion: '',
    eventId: ''
  });

  const [formStatus, setFormStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('regional_luncheon_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        return;
      }

      setSettings(data);
      if (data) {
        setFormData(prev => ({ ...prev, eventId: data.id }));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'numberOfAttendees' ? parseInt(value) || 1 : value
    }));
  };

  const handleSubmit = async (data: any, isVerified: boolean, turnstileToken?: string) => {
    if (!isVerified || !turnstileToken) {
      setFormStatus({
        success: false,
        message: 'Please complete the security verification.'
      });
      return;
    }

    // Validate form data
    if (!formData.name || !formData.email || !formData.districtOrganization || !formData.preferredRegion) {
      setFormStatus({
        success: false,
        message: 'Please fill in all required fields.'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      setFormStatus({
        success: false,
        message: 'Please enter a valid email address.'
      });
      return;
    }

    if (formData.numberOfAttendees < 1 || formData.numberOfAttendees > 3) {
      setFormStatus({
        success: false,
        message: 'Number of attendees must be between 1 and 3.'
      });
      return;
    }

    try {
      console.log('Submitting regional luncheon registration with data:', formData);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-regional-luncheon`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            districtOrganization: formData.districtOrganization,
            numberOfAttendees: formData.numberOfAttendees,
            preferredRegion: formData.preferredRegion,
            eventId: settings?.id || null,
            turnstileToken
          })
        }
      );

      const result = await response.json();
      console.log('Server response:', { status: response.status, result });

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to submit registration');
      }

      setFormStatus({
        success: true,
        message: 'Registration submitted successfully! We look forward to seeing you at the regional luncheon.'
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        districtOrganization: '',
        numberOfAttendees: 1,
        preferredRegion: ''
      });
      
    } catch (error) {
      console.error('Error submitting registration:', error);
      setFormStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit registration. Please try again.'
      });
    }
  };

  // Check if registration deadline has passed
  const registrationDeadline = settings?.registration_deadline 
    ? new Date(settings.registration_deadline) 
    : null;
  const now = new Date();
  const isRegistrationClosed = registrationDeadline ? now > registrationDeadline : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-b-4 border-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg">
            <div className="flex items-start">
              <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Active Event</h3>
                <p className="text-yellow-700">
                  There is currently no active regional luncheon event. Please check back later or contact us for more information.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-{registrationDeadline?.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}e-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {settings.name}
          </h1>
          {settings.description && (
            <p className="text-lg text-gray-700 max-w-2xl mx-auto mt-4">
              {settings.description}
            </p>
          )}
        </div>

        {/* Registration Deadline Alert */}
        {isRegistrationClosed ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-6 mb-8 rounded-r-lg">
            <div className="flex items-start">
              <AlertCircle className="w-6 h-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Registration Closed</h3>
                <p className="text-red-700">
                  The registration deadline has passed. If you have questions, please contact us.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 mb-8 rounded-r-lg">
            <div className="flex items-start">
              <Calendar className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Registration Deadline</h3>
                <p className="text-yellow-700">
                  Please register by <strong>{settings?.registration_deadline ? (() => {
                    const dateStr = settings.registration_deadline.split('T')[0];
                    const [year, month, day] = dateStr.split('-');
                    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                    return date.toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric'
                    });
                  })() : ''}</strong> so we can plan for food and seating.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Regional Luncheon Details */}
        <div className="bg-white shadow-lg rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Regional Luncheon Dates & Locations</h2>
          <div className="space-y-4">
            {settings.regional_dates && settings.regional_dates.length > 0 ? (
              settings.regional_dates.map((luncheon, index) => (
                <div key={index} className="flex items-start border-l-4 border-blue-500 pl-4 py-2">
                  <MapPin className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900">{luncheon.region}</p>
                    <p className="text-gray-600">
                      {new Date(luncheon.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })} – {luncheon.time}
                    </p>
                    {luncheon.venue && (
                      <p className="text-sm text-gray-500 italic">{luncheon.venue}</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 italic">Regional dates will be announced soon.</p>
            )}
          </div>
          <p className="text-sm text-gray-500 italic mt-4">
            Please note: Some venues are still being finalized, but we encourage you to register early so we can plan for food and seating.
          </p>
        </div>

        {/* Important Details */}
        <div className="bg-blue-50 shadow-lg rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Important Details</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <Users className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Small Groups Only</p>
                <p className="text-gray-700">
                  To ensure space and meaningful interaction, we ask each district or organization to send <strong>no more than 2-3 team members</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-start mt-4">
              <CheckCircle className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">Why Attend?</p>
                <ul className="list-disc list-inside text-gray-700 ml-1 space-y-1">
                  <li>Enjoy a great meal and fellowship</li>
                  <li>Share ideas and best practices</li>
                  <li>Learn from peers and industry leaders</li>
                  <li>Help strengthen our statewide transportation network</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Registration Form */}
        {!isRegistrationClosed && (
          <div className="bg-white shadow-lg rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Register Now</h2>

            {/* Status Messages */}
            {formStatus.message && (
              <div className={`mb-6 p-4 rounded-lg ${
                formStatus.success 
                  ? 'bg-green-50 border border-green-200 text-green-800' 
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                <div className="flex items-start">
                  {formStatus.success ? (
                    <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                  )}
                  <p>{formStatus.message}</p>
                </div>
              </div>
            )}

            <SecureForm onSubmit={handleSubmit}>
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="inline w-4 h-4 mr-1" />
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="inline w-4 h-4 mr-1" />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="john.doe@example.com"
                    required
                  />
                </div>

                {/* District/Organization */}
                <div>
                  <label htmlFor="districtOrganization" className="block text-sm font-medium text-gray-700 mb-2">
                    <Building className="inline w-4 h-4 mr-1" />
                    District/Organization *
                  </label>
                  <input
                    type="text"
                    id="districtOrganization"
                    name="districtOrganization"
                    value={formData.districtOrganization}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Example School District"
                    required
                  />
                </div>

                {/* Number of Attendees */}
                <div>
                  <label htmlFor="numberOfAttendees" className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="inline w-4 h-4 mr-1" />
                    Number of Attendees (1-3) *
                  </label>
                  <select
                    id="numberOfAttendees"
                    name="numberOfAttendees"
                    value={formData.numberOfAttendees}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value={1}>1 Person</option>
                    <option value={2}>2 People</option>
                    <option value={3}>3 People</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Maximum of 3 team members per district/organization
                  </p>
                </div>

                {/* Preferred Region */}
                <div>
                  <label htmlFor="preferredRegion" className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="inline w-4 h-4 mr-1" />
                    Preferred Region *
                  </label>
                  <select
                    id="preferredRegion"
                    name="preferredRegion"
                    value={formData.preferredRegion}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a region...</option>
                    {settings.regional_dates && settings.regional_dates.map((luncheon, index) => (
                      <option key={index} value={luncheon.region}>
                        {luncheon.region} – {new Date(luncheon.date).toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric' 
                        })} at {luncheon.time}
                        {luncheon.venue ? ` (${luncheon.venue})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-sm text-gray-500 text-center">
                  * Required fields
                </p>
              </div>
            </SecureForm>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegionalLuncheonRegistration;
