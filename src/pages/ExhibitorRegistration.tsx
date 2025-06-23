import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, Building, User, AlertCircle, Briefcase, FileText } from 'lucide-react';
import { handleError } from '../lib/errors';

interface ExhibitorSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  registration_end_date: string;
  location: string;
  venue: string;
  fee: number;
  payment_instructions: string;
  description: string;
  is_active: boolean;
}

const ExhibitorRegistration: React.FC = () => {
  const [formData, setFormData] = useState({
    businessName: '',
    firstName: '',
    lastName: '',
    streetAddress: '',
    streetAddress2: '',
    city: '',
    state: '',
    zipCode: '',
    email: '',
    phone: '',
    mobilePhone: '',
    boothRequirements: '',
    productsDescription: '',
    additionalComments: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  const [exhibitorSettings, setExhibitorSettings] = useState<ExhibitorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistrationClosed, setIsRegistrationClosed] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchExhibitorSettings();
  }, []);

  const fetchExhibitorSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exhibitor_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching exhibitor settings:', error);
        setError('Failed to load exhibitor settings. Please try again later.');
        return;
      }

      if (!data) {
        setError('No active exhibitor registration is available at this time.');
        setIsRegistrationClosed(true);
        return;
      }

      setExhibitorSettings(data);

      // Check if registration deadline has passed
      if (data.registration_end_date) {
        const endDate = new Date(data.registration_end_date);
        const now = new Date();
        
        if (now > endDate) {
          setIsRegistrationClosed(true);
          setError(`Registration closed on ${endDate.toLocaleDateString()}`);
        } else {
          setIsRegistrationClosed(false);
          setError(null);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!exhibitorSettings?.is_active) {
      setFormStatus({
        success: false,
        message: 'Registration is not currently available.'
      });
      return;
    }

    if (isRegistrationClosed) {
      setFormStatus({
        success: false,
        message: 'Registration is closed. The deadline has passed.'
      });
      return;
    }

    setIsSubmitting(true);
    setFormStatus({});

    try {
      // Get the Supabase URL from environment variables
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined');
      }

      // Prepare the request payload
      const payload = {
        businessName: formData.businessName,
        firstName: formData.firstName,
        lastName: formData.lastName,
        streetAddress: formData.streetAddress,
        streetAddress2: formData.streetAddress2 || undefined,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        email: formData.email,
        phone: formData.phone,
        mobilePhone: formData.mobilePhone || undefined,
        boothRequirements: formData.boothRequirements || undefined,
        productsDescription: formData.productsDescription || undefined,
        additionalComments: formData.additionalComments || undefined
      };

      // Make the request to the Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/submit-exhibitor-registration`, {
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
        throw new Error(errorData.error || 'Failed to submit registration');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to submit registration');
      }

      setFormStatus({
        success: true,
        message: 'Registration submitted successfully! Please mail your payment as instructed.'
      });
      
      // Reset form
      setFormData({
        businessName: '',
        firstName: '',
        lastName: '',
        streetAddress: '',
        streetAddress2: '',
        city: '',
        state: '',
        zipCode: '',
        email: '',
        phone: '',
        mobilePhone: '',
        boothRequirements: '',
        productsDescription: '',
        additionalComments: ''
      });
    } catch (error: any) {
      console.error('Error submitting registration:', error);
      const { message } = handleError(error);
      setFormStatus({
        success: false,
        message: `Error submitting registration: ${message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">Exhibitor Registration</h1>
            <p className="text-xl text-gray-200 mb-8 fade-in">Register as an exhibitor for the {exhibitorSettings?.name || 'TAPT Event'} and showcase your products and services to transportation professionals from across Tennessee.</p>
          </div>
        </div>
      </section>

      {/* Exhibitor Info */}
      {!isRegistrationClosed && exhibitorSettings?.is_active && (
        <section className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="p-8 md:p-10">
                <h2 className="text-3xl font-bold text-secondary mb-6">{exhibitorSettings?.name || 'TAPT Exhibitor Event'}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Event Details</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <MapPin className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Location:</span>
                          <p>{exhibitorSettings?.venue}</p>
                          <p>{exhibitorSettings?.location}</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <AlertCircle className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Dates:</span>
                          <p>{new Date(exhibitorSettings?.start_date || '').toLocaleDateString()} - {new Date(exhibitorSettings?.end_date || '').toLocaleDateString()}</p>
                          <p className="text-sm text-red-600">Registration Deadline: {new Date(exhibitorSettings?.registration_end_date || '').toLocaleDateString()}</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Exhibitor Information</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <Briefcase className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Exhibitor Fee:</span>
                          <p>${exhibitorSettings?.fee.toFixed(2)}</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <FileText className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Payment Instructions:</span>
                          <p>{exhibitorSettings?.payment_instructions}</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                {exhibitorSettings?.description && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-md">
                    <p className="text-gray-700">{exhibitorSettings.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Registration Form */}
      {isRegistrationClosed || !exhibitorSettings?.is_active ? (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Briefcase className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-secondary mb-4">Exhibitor Registration has now closed</h2>
              <p className="text-gray-600">
                Thank you for your interest in exhibiting at the TAPT event. Registration is currently closed. 
                Please check back later for future events or contact us for more information.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {formStatus.message && (
              <div className={`mb-8 p-4 rounded-md ${formStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {formStatus.success ? (
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm ${formStatus.success ? 'text-green-800' : 'text-red-800'}`}>
                      {formStatus.message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-lg p-8">
              {/* Business Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Business Information</h2>
                <div>
                  <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="businessName"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      required
                      className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Primary Contact</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="mobilePhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Mobile Phone (Optional)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="mobilePhone"
                        name="mobilePhone"
                        value={formData.mobilePhone}
                        onChange={handleChange}
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Business Address</h2>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="streetAddress" className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="streetAddress"
                        name="streetAddress"
                        value={formData.streetAddress}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="streetAddress2" className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address Line 2 (Optional)
                    </label>
                    <input
                      type="text"
                      id="streetAddress2"
                      name="streetAddress2"
                      value={formData.streetAddress2}
                      onChange={handleChange}
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>

                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                        State <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      >
                        <option value="">Select State</option>
                        <option value="AL">Alabama</option>
                        <option value="AK">Alaska</option>
                        <option value="AZ">Arizona</option>
                        <option value="AR">Arkansas</option>
                        <option value="CA">California</option>
                        <option value="CO">Colorado</option>
                        <option value="CT">Connecticut</option>
                        <option value="DE">Delaware</option>
                        <option value="FL">Florida</option>
                        <option value="GA">Georgia</option>
                        <option value="HI">Hawaii</option>
                        <option value="ID">Idaho</option>
                        <option value="IL">Illinois</option>
                        <option value="IN">Indiana</option>
                        <option value="IA">Iowa</option>
                        <option value="KS">Kansas</option>
                        <option value="KY">Kentucky</option>
                        <option value="LA">Louisiana</option>
                        <option value="ME">Maine</option>
                        <option value="MD">Maryland</option>
                        <option value="MA">Massachusetts</option>
                        <option value="MI">Michigan</option>
                        <option value="MN">Minnesota</option>
                        <option value="MS">Mississippi</option>
                        <option value="MO">Missouri</option>
                        <option value="MT">Montana</option>
                        <option value="NE">Nebraska</option>
                        <option value="NV">Nevada</option>
                        <option value="NH">New Hampshire</option>
                        <option value="NJ">New Jersey</option>
                        <option value="NM">New Mexico</option>
                        <option value="NY">New York</option>
                        <option value="NC">North Carolina</option>
                        <option value="ND">North Dakota</option>
                        <option value="OH">Ohio</option>
                        <option value="OK">Oklahoma</option>
                        <option value="OR">Oregon</option>
                        <option value="PA">Pennsylvania</option>
                        <option value="RI">Rhode Island</option>
                        <option value="SC">South Carolina</option>
                        <option value="SD">South Dakota</option>
                        <option value="TN">Tennessee</option>
                        <option value="TX">Texas</option>
                        <option value="UT">Utah</option>
                        <option value="VT">Vermont</option>
                        <option value="VA">Virginia</option>
                        <option value="WA">Washington</option>
                        <option value="WV">West Virginia</option>
                        <option value="WI">Wisconsin</option>
                        <option value="WY">Wyoming</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                        ZIP Code <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="zipCode"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleChange}
                        required
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Booth Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Booth Information</h2>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="boothRequirements" className="block text-sm font-medium text-gray-700 mb-1">
                      Booth Requirements (Optional)
                    </label>
                    <textarea
                      id="boothRequirements"
                      name="boothRequirements"
                      value={formData.boothRequirements}
                      onChange={handleChange}
                      rows={3}
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      placeholder="Special requirements for your booth (electricity, internet, etc.)"
                    />
                  </div>

                  <div>
                    <label htmlFor="productsDescription" className="block text-sm font-medium text-gray-700 mb-1">
                      Products/Services Description (Optional)
                    </label>
                    <textarea
                      id="productsDescription"
                      name="productsDescription"
                      value={formData.productsDescription}
                      onChange={handleChange}
                      rows={3}
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      placeholder="Brief description of the products or services you'll be exhibiting"
                    />
                  </div>

                  <div>
                    <label htmlFor="additionalComments" className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Comments (Optional)
                    </label>
                    <textarea
                      id="additionalComments"
                      name="additionalComments"
                      value={formData.additionalComments}
                      onChange={handleChange}
                      rows={3}
                      className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      placeholder="Any additional information or requests"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Submit Registration'
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </div>
  );
};

export default ExhibitorRegistration;