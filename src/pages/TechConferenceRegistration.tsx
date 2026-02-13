import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, DollarSign, Building, User, Users, Calendar, AlertCircle, X } from 'lucide-react';
import { SecureForm } from '../components/forms/SecureForm';
import type { SecureFormHandle } from '../components/forms/SecureForm';
import { PaymentMethodSelector } from '../components/forms/PaymentMethodSelector';
import { PayPalButton } from '../components/forms/PayPalButton';
import { PayPalOrderDetails, getPayPalTransactionId } from '../config/paypal';
import { SuccessModal } from '../components/ui/SuccessModal';
import { MealTicketSelection } from '../components/forms/MealTicketSelection';
import type { MealOption } from '../components/forms/MealTicketSelection';

interface Attendee {
  firstName: string;
  lastName: string;
  email: string;
}

interface TechConferenceSettings {
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
  meal_price?: number;
  meals_available?: MealOption[];
}

const TechConferenceRegistration: React.FC = () => {
  const secureFormRef = useRef<SecureFormHandle>(null);
  const [formData, setFormData] = useState({
    // Registration type flag
    registrantIsAttendee: true,
    
    // Billing/Registrant Information (person filling out the form)
    billingFirstName: '',
    billingLastName: '',
    billingEmail: '',
    billingPhone: '',
    
    // Primary Attendee (only used if registrantIsAttendee is false)
    primaryAttendeeFirstName: '',
    primaryAttendeeLastName: '',
    primaryAttendeeEmail: '',
    primaryAttendeeSchoolDistrict: '',
    
    // Organization Info
    schoolDistrict: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    
    // Attendee tracking
    totalAttendees: 1,
    additionalAttendees: [] as Attendee[]
  });

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'po' | 'paypal' | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [paypalDetails, setPaypalDetails] = useState<PayPalOrderDetails | null>(null);

  // Meal selection state
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);
  const [allMealsSelected, setAllMealsSelected] = useState(false);

  const [formStatus, setFormStatus] = useState<{
    success?: boolean;
    message?: string;
  }>({});

  const [conferenceSettings, setConferenceSettings] = useState<TechConferenceSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [isRegistrationClosed, setIsRegistrationClosed] = useState(false);
  const [showUnavailablePopup, setShowUnavailablePopup] = useState(false);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalContent, setSuccessModalContent] = useState({
    title: 'Registration Complete!',
    message: '',
    subMessage: ''
  });

  useEffect(() => {
    fetchConferenceSettings();
  }, []);

  const fetchConferenceSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tech_conference_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle(); // Use maybeSingle instead of single

      if (error) {
        console.error('Error fetching tech conference settings:', error);
        setShowUnavailablePopup(true);
        return;
      }

      if (!data) {
        setShowUnavailablePopup(true);
        return;
      }

      setConferenceSettings(data);

      // Check if registration deadline has passed
      if (data.registration_end_date) {
        const endDate = new Date(data.registration_end_date);
        const now = new Date();
        
        if (now > endDate) {
          setIsRegistrationClosed(true);
        } else {
          setIsRegistrationClosed(false);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      setShowUnavailablePopup(true);
    } finally {
      setLoading(false);
    }
  };

  const registrationFee = conferenceSettings?.fee ?? 250.00;
  const mealPrice = conferenceSettings?.meal_price ?? 40.00;
  const mealsAvailable: MealOption[] = conferenceSettings?.meals_available ?? [];
  const enabledMeals = useMemo(() => mealsAvailable.filter(m => m.enabled), [mealsAvailable]);

  const registrationSubtotal = formData.totalAttendees * registrationFee;
  const mealTotal = selectedMeals.length * mealPrice * formData.totalAttendees;
  const totalAmount = registrationSubtotal + mealTotal;

  // Validate required fields before allowing PayPal payment
  // This prevents users from paying before filling out the form
  const getFormValidationErrors = (): string[] => {
    const errors: string[] = [];
    
    // Billing/registrant fields
    if (!formData.billingFirstName.trim()) errors.push('First Name');
    if (!formData.billingLastName.trim()) errors.push('Last Name');
    if (!formData.billingEmail.trim()) errors.push('Email');
    if (!formData.billingPhone.trim()) errors.push('Phone');
    if (!formData.streetAddress.trim()) errors.push('Street Address');
    if (!formData.city.trim()) errors.push('City');
    if (!formData.state) errors.push('State');
    if (!formData.zipCode.trim()) errors.push('ZIP Code');

    // Conditional fields based on registration type
    if (formData.registrantIsAttendee) {
      if (!formData.schoolDistrict.trim()) errors.push('School District / Organization');
    } else {
      if (!formData.primaryAttendeeFirstName.trim()) errors.push('Primary Attendee First Name');
      if (!formData.primaryAttendeeLastName.trim()) errors.push('Primary Attendee Last Name');
      if (!formData.primaryAttendeeEmail.trim()) errors.push('Primary Attendee Email');
      if (!formData.primaryAttendeeSchoolDistrict.trim()) errors.push('Primary Attendee School District');
    }

    // Additional attendees validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (let i = 0; i < formData.additionalAttendees.length; i++) {
      const attendee = formData.additionalAttendees[i];
      if (!attendee.firstName.trim()) errors.push(`Attendee ${i + 2} First Name`);
      if (!attendee.lastName.trim()) errors.push(`Attendee ${i + 2} Last Name`);
      if (!attendee.email.trim()) errors.push(`Attendee ${i + 2} Email`);
      else if (!emailRegex.test(attendee.email.trim())) errors.push(`Attendee ${i + 2} valid Email`);
    }

    return errors;
  };

  const formValidationErrors = getFormValidationErrors();

  // Meal handlers
  const handleMealToggle = useCallback((mealId: string) => {
    setSelectedMeals(prev => {
      if (prev.includes(mealId)) {
        return prev.filter(id => id !== mealId);
      }
      return [...prev, mealId];
    });
    setAllMealsSelected(false);
  }, []);

  const handleAllMealsToggle = useCallback((selectAll: boolean) => {
    setAllMealsSelected(selectAll);
    if (selectAll) {
      setSelectedMeals(enabledMeals.map(m => m.id));
    } else {
      setSelectedMeals([]);
    }
  }, [enabledMeals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'totalAttendees') {
      const attendees = Math.max(1, parseInt(value) || 1);
      const currentAttendees = formData.additionalAttendees;
      
      if (attendees > 1) {
        const diff = attendees - 1 - currentAttendees.length;
        if (diff > 0) {
          const newAttendees = [...currentAttendees];
          for (let i = 0; i < diff; i++) {
            newAttendees.push({ firstName: '', lastName: '', email: '' });
          }
          setFormData(prev => ({
            ...prev,
            [name]: attendees,
            additionalAttendees: newAttendees
          }));
        } else if (diff < 0) {
          setFormData(prev => ({
            ...prev,
            [name]: attendees,
            additionalAttendees: currentAttendees.slice(0, attendees - 1)
          }));
        }
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: attendees,
          additionalAttendees: []
        }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleRegistrantTypeChange = (isAttendee: boolean) => {
    setFormData(prev => ({
      ...prev,
      registrantIsAttendee: isAttendee,
      // Clear primary attendee fields if switching back to "I am attending"
      ...(isAttendee ? {
        primaryAttendeeFirstName: '',
        primaryAttendeeLastName: '',
        primaryAttendeeEmail: '',
        primaryAttendeeSchoolDistrict: ''
      } : {})
    }));
  };

  const handleAttendeeChange = (index: number, field: keyof Attendee, value: string) => {
    setFormData(prev => {
      const newAttendees = [...prev.additionalAttendees];
      newAttendees[index] = { ...newAttendees[index], [field]: value };
      return { ...prev, additionalAttendees: newAttendees };
    });
  };

  const handleSecureSubmit = async (data: any, isVerified: boolean, turnstileToken?: string) => {
    if (!conferenceSettings?.is_active) {
      throw new Error('Registration is not currently available.');
    }

    if (isRegistrationClosed) {
      throw new Error('Registration is closed. The deadline has passed.');
    }

    if (!turnstileToken) {
      throw new Error('Security verification is required.');
    }

    // Validate payment method
    if (!paymentMethod) {
      throw new Error('Please select a payment method.');
    }

    if (paymentMethod === 'po' && !poNumber.trim()) {
      throw new Error('Please enter a purchase order number.');
    }

    if (paymentMethod === 'paypal' && !paypalDetails) {
      throw new Error('Please complete PayPal payment before submitting.');
    }

    // Validate school district based on registration type
    if (formData.registrantIsAttendee) {
      if (!formData.schoolDistrict.trim()) {
        throw new Error('Please provide your school district or organization.');
      }
    } else {
      // Validate primary attendee fields if registrant is not attending
      if (!formData.primaryAttendeeFirstName.trim() || !formData.primaryAttendeeLastName.trim() || !formData.primaryAttendeeEmail.trim()) {
        throw new Error('Please provide primary attendee information.');
      }
      if (!formData.primaryAttendeeSchoolDistrict.trim()) {
        throw new Error('Please provide the primary attendee\'s school district or organization.');
      }
    }

    // Validate additional attendee fields
    if (formData.additionalAttendees.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      for (let i = 0; i < formData.additionalAttendees.length; i++) {
        const attendee = formData.additionalAttendees[i];
        if (!attendee.firstName.trim() || !attendee.lastName.trim() || !attendee.email.trim()) {
          throw new Error(`Please fill in all fields for additional attendee ${i + 1}.`);
        }
        if (!emailRegex.test(attendee.email.trim())) {
          throw new Error(`Please enter a valid email address for additional attendee ${i + 1} (${attendee.firstName} ${attendee.lastName}).`);
        }
      }
    }

    try {
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Configuration error. Please contact support.');
      }

      const payload = {
        // Billing contact (person filling out the form - receives invoices)
        billingFirstName: formData.billingFirstName,
        billingLastName: formData.billingLastName,
        billingEmail: formData.billingEmail,
        billingPhone: formData.billingPhone,
        registrantIsAttendee: formData.registrantIsAttendee,
        
        // Primary attendee info (for backward compatibility - main attendee)
        firstName: formData.registrantIsAttendee 
          ? formData.billingFirstName 
          : formData.primaryAttendeeFirstName,
        lastName: formData.registrantIsAttendee 
          ? formData.billingLastName 
          : formData.primaryAttendeeLastName,
        email: formData.registrantIsAttendee 
          ? formData.billingEmail 
          : formData.primaryAttendeeEmail,
        phone: formData.billingPhone,
        
        // Organization info - use primary attendee's school district when registering for others
        schoolDistrict: formData.registrantIsAttendee 
          ? formData.schoolDistrict 
          : formData.primaryAttendeeSchoolDistrict,
        streetAddress: formData.streetAddress,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        
        // Registration details
        totalAttendees: formData.totalAttendees,
        totalAmount,
        conferenceId: conferenceSettings?.id,
        additionalAttendees: formData.additionalAttendees,
        turnstileToken,
        
        // Payment fields
        paymentMethod,
        poNumber: paymentMethod === 'po' ? poNumber : null,
        paypalTransactionId: paymentMethod === 'paypal' && paypalDetails ? getPayPalTransactionId(paypalDetails) : null,
        paypalPayerEmail: paymentMethod === 'paypal' ? paypalDetails?.payer?.email_address : null,
        paymentStatus: paymentMethod === 'paypal' ? 'completed' : 'pending',
        
        // Meal selections
        mealSelections: selectedMeals,
        allMealsSelected
      };

      const response = await fetch(`${supabaseUrl}/functions/v1/submit-tech-conference-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(payload)
      });

      // Check if the request was successful
      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Server communication error. Please try again.');
      }

      // Debug: Log response details
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', result);

      if (!response.ok) {
        throw new Error(result?.error || `Server error (${response.status}). Please try again.`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Registration failed. Please try again.');
      }

      // Success - Show modal instead of inline message
      const isPayPal = paymentMethod === 'paypal';
      setSuccessModalContent({
        title: 'Registration Complete!',
        message: isPayPal 
          ? 'Your Tech Conference registration and payment have been successfully processed.'
          : 'Your Tech Conference registration has been successfully submitted.',
        subMessage: isPayPal
          ? 'A confirmation email will be sent to your email address shortly.'
          : 'An invoice will be sent to your email address. Please submit payment according to the instructions provided.'
      });
      setShowSuccessModal(true);
      
      // Clear any inline status messages
      setFormStatus({});
      
      // Reset form
      setFormData({
        registrantIsAttendee: true,
        billingFirstName: '',
        billingLastName: '',
        billingEmail: '',
        billingPhone: '',
        primaryAttendeeFirstName: '',
        primaryAttendeeLastName: '',
        primaryAttendeeEmail: '',
        primaryAttendeeSchoolDistrict: '',
        schoolDistrict: '',
        streetAddress: '',
        city: '',
        state: '',
        zipCode: '',
        totalAttendees: 1,
        additionalAttendees: []
      });
      
      // Reset payment state
      setPaymentMethod(null);
      setPoNumber('');
      setPaypalDetails(null);
      
      // Reset meal state
      setSelectedMeals([]);
      setAllMealsSelected(false);

    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Handle specific error types
      if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
      throw error;
    }
  };

  const handlePayPalSuccess = (details: PayPalOrderDetails) => {
    console.log('✅ PayPal payment successful:', details);
    setPaypalDetails(details);
    
    // Reset Turnstile to get a fresh token for form submission
    // The previous token may have expired during the PayPal payment flow (tokens expire after 5 minutes)
    if (secureFormRef.current) {
      console.log('🔒 Resetting Turnstile after PayPal payment to get fresh token');
      secureFormRef.current.resetTurnstile();
    }
    
    setFormStatus({
      success: true,
      message: 'Payment completed! Please complete the security verification below and click Register to finish your registration.'
    });
  };

  const handlePayPalError = (error: any) => {
    console.error('❌ PayPal payment failed:', error);
    setFormStatus({
      success: false,
      message: 'PayPal payment failed. Please try again or use a different payment method.'
    });
  };

  const handlePayPalCancel = () => {
    console.log('⚠️ PayPal payment cancelled');
    setFormStatus({
      success: false,
      message: 'Payment cancelled. You can try again or select a different payment method.'
    });
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
      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successModalContent.title}
        message={successModalContent.message}
        subMessage={successModalContent.subMessage}
      />

      {/* Unavailable Popup */}
      {showUnavailablePopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
                <h2 className="text-xl font-bold text-gray-900">Registration Unavailable</h2>
              </div>
              <button
                onClick={() => setShowUnavailablePopup(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              Tech Conference registration is not available at this time. Please check back later or contact us for more information.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowUnavailablePopup(false)}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">Tech Conference Registration</h1>
            <p className="text-xl text-gray-200 mb-8 fade-in">Register for the {conferenceSettings?.name || 'TAPT Tech Conference'} and join transportation professionals from across Tennessee.</p>
          </div>
        </div>
      </section>

      {/* Conference Info */}
      {!isRegistrationClosed && conferenceSettings?.is_active && (
        <section className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="p-8 md:p-10">
                <h2 className="text-3xl font-bold text-secondary mb-6">{conferenceSettings?.name || 'TAPT Tech Conference'}</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Event Details</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <Calendar className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Conference Dates:</span>
                          <p>{(() => {
                            if (!conferenceSettings?.start_date || !conferenceSettings?.end_date) return '';
                            const startStr = conferenceSettings.start_date.includes('T') ? conferenceSettings.start_date.split('T')[0] : conferenceSettings.start_date;
                            const endStr = conferenceSettings.end_date.includes('T') ? conferenceSettings.end_date.split('T')[0] : conferenceSettings.end_date;
                            const [y1, m1, d1] = startStr.split('-');
                            const [y2, m2, d2] = endStr.split('-');
                            const start = new Date(parseInt(y1), parseInt(m1) - 1, parseInt(d1));
                            const end = new Date(parseInt(y2), parseInt(m2) - 1, parseInt(d2));
                            return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
                          })()}</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <MapPin className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Location:</span>
                          <p>{conferenceSettings?.venue}</p>
                          <p>{conferenceSettings?.location}</p>
                        </div>
                      </li>
                    </ul>

                    {/* Registration Deadline - Prominent Display */}
                    <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-lg p-4">
                      <div className="flex items-center">
                        <AlertCircle className="h-6 w-6 text-yellow-600 mr-2 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-bold text-yellow-900 mb-1">Registration Deadline</h4>
                          <p className="text-xl font-bold text-yellow-700">
                            {(() => {
                              if (!conferenceSettings?.registration_end_date) return '';
                              const deadlineStr = conferenceSettings.registration_end_date.includes('T') ? conferenceSettings.registration_end_date.split('T')[0] : conferenceSettings.registration_end_date;
                              const [y, m, d] = deadlineStr.split('-');
                              const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                              return date.toLocaleDateString('en-US', { 
                                weekday: 'long',
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              });
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Registration Information</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <DollarSign className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Registration Fee:</span>
                          <p>${registrationFee.toFixed(2)} per attendee</p>
                        </div>
                      </li>
                      {enabledMeals.length > 0 && (
                        <li className="flex items-start">
                          <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                            🍽️
                          </span>
                          <div>
                            <span className="font-medium">Meal Tickets:</span>
                            <p>${mealPrice.toFixed(2)} per meal per person</p>
                            <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                              {enabledMeals.map(meal => (
                                <li key={meal.id}>{meal.label} — ${mealPrice.toFixed(2)}</li>
                              ))}
                            </ul>
                          </div>
                        </li>
                      )}
                      <li className="flex items-start">
                        <span className="flex-shrink-0 h-6 w-6 text-primary mr-2">
                          <Mail className="h-6 w-6" />
                        </span>
                        <div>
                          <span className="font-medium">Payment Instructions:</span>
                          <p>{conferenceSettings?.payment_instructions}</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>

                {conferenceSettings?.description && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-md">
                    <p className="text-gray-700">{conferenceSettings.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Registration Form */}
      {isRegistrationClosed || !conferenceSettings?.is_active ? (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <Calendar className="h-16 w-16 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-secondary mb-4">Registration has now closed</h2>
              <p className="text-gray-600">
                Thank you for your interest in the TAPT Tech Conference. Registration is currently closed. 
                Please check back later for future events.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* ✅ FIXED: Only show success messages - SecureForm handles errors */}
            {formStatus.success && formStatus.message && (
              <div className="mb-8 p-4 rounded-md bg-green-50 border border-green-200">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">{formStatus.message}</p>
                  </div>
                </div>
              </div>
            )}

            <SecureForm ref={secureFormRef} onSubmit={handleSecureSubmit} className="bg-white shadow-lg rounded-lg p-8">
              {/* Registration Type Selection */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-4">Registration Type</h2>
                <p className="text-sm text-gray-600 mb-4">
                  Are you registering for yourself or on behalf of others?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleRegistrantTypeChange(true)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      formData.registrantIsAttendee
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <User className={`h-5 w-5 mr-2 ${formData.registrantIsAttendee ? 'text-primary' : 'text-gray-400'}`} />
                      <span className="font-medium">I am attending</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      I'm registering myself (and possibly others)
                    </p>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleRegistrantTypeChange(false)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      !formData.registrantIsAttendee
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <Users className={`h-5 w-5 mr-2 ${!formData.registrantIsAttendee ? 'text-primary' : 'text-gray-400'}`} />
                      <span className="font-medium">Registering for others</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      I'm a bookkeeper, admin, or registering on behalf of attendees
                    </p>
                  </button>
                </div>
              </div>

              {/* Billing/Registrant Information */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-2">
                  {formData.registrantIsAttendee ? 'Your Information' : 'Billing Contact'}
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  {formData.registrantIsAttendee 
                    ? 'Enter your contact information.' 
                    : 'Enter your contact information for invoices and payment confirmation.'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="billingFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="billingFirstName"
                        name="billingFirstName"
                        value={formData.billingFirstName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="billingLastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="billingLastName"
                        name="billingLastName"
                        value={formData.billingLastName}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="billingEmail" className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="billingEmail"
                        name="billingEmail"
                        value={formData.billingEmail}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="billingPhone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        id="billingPhone"
                        name="billingPhone"
                        value={formData.billingPhone}
                        onChange={handleChange}
                        required
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* School District (shown when registrant IS attending) */}
              {formData.registrantIsAttendee && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-secondary mb-6">Organization Information</h2>
                  <div>
                    <label htmlFor="schoolDistrict" className="block text-sm font-medium text-gray-700 mb-1">
                      School District or Organization <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="schoolDistrict"
                        name="schoolDistrict"
                        value={formData.schoolDistrict}
                        onChange={handleChange}
                        required={formData.registrantIsAttendee}
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Attendee (only shown if registrant is NOT attending) */}
              {!formData.registrantIsAttendee && (
                <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h2 className="text-xl font-semibold text-secondary mb-2">Primary Attendee</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Enter the information for the main attendee. This person will receive event details and updates.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label htmlFor="primaryAttendeeFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="primaryAttendeeFirstName"
                        name="primaryAttendeeFirstName"
                        value={formData.primaryAttendeeFirstName}
                        onChange={handleChange}
                        required={!formData.registrantIsAttendee}
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>

                    <div>
                      <label htmlFor="primaryAttendeeLastName" className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="primaryAttendeeLastName"
                        name="primaryAttendeeLastName"
                        value={formData.primaryAttendeeLastName}
                        onChange={handleChange}
                        required={!formData.registrantIsAttendee}
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>

                    <div>
                      <label htmlFor="primaryAttendeeEmail" className="block text-sm font-medium text-gray-700 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        id="primaryAttendeeEmail"
                        name="primaryAttendeeEmail"
                        value={formData.primaryAttendeeEmail}
                        onChange={handleChange}
                        required={!formData.registrantIsAttendee}
                        className="block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                      />
                    </div>
                  </div>
                  
                  {/* School District for Primary Attendee */}
                  <div className="mt-6">
                    <label htmlFor="primaryAttendeeSchoolDistrict" className="block text-sm font-medium text-gray-700 mb-1">
                      School District or Organization <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="primaryAttendeeSchoolDistrict"
                        name="primaryAttendeeSchoolDistrict"
                        value={formData.primaryAttendeeSchoolDistrict}
                        onChange={handleChange}
                        required={!formData.registrantIsAttendee}
                        className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                        placeholder="Enter the attendee's school district or organization"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Address */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Address</h2>
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

              {/* Attendees */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Registration Details</h2>
                <div>
                  <label htmlFor="totalAttendees" className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Attendees <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Users className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      id="totalAttendees"
                      name="totalAttendees"
                      value={formData.totalAttendees}
                      onChange={handleChange}
                      required
                      min="1"
                      className="pl-10 block w-full shadow-sm focus:ring-primary focus:border-primary rounded-md border-gray-300"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">Registration fee: ${registrationFee.toFixed(2)} per attendee</p>
                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Registration Subtotal:</span>
                      <span className="text-lg font-bold text-gray-700">${registrationSubtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meal Ticket Selection */}
              {enabledMeals.length > 0 && (
                <div className="mb-8">
                  <MealTicketSelection
                    mealsAvailable={mealsAvailable}
                    mealPrice={mealPrice}
                    selectedMeals={selectedMeals}
                    allMealsSelected={allMealsSelected}
                    onMealToggle={handleMealToggle}
                    onAllMealsToggle={handleAllMealsToggle}
                  />
                </div>
              )}

              {/* Grand Total */}
              <div className="mb-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>Registration ({formData.totalAttendees} attendee{formData.totalAttendees !== 1 ? 's' : ''} × ${registrationFee.toFixed(2)}):</span>
                    <span>${registrationSubtotal.toFixed(2)}</span>
                  </div>
                  {selectedMeals.length > 0 && (
                    <div className="flex justify-between items-center text-sm text-gray-600">
                      <span>Meals ({selectedMeals.length} meal{selectedMeals.length !== 1 ? 's' : ''} × ${mealPrice.toFixed(2)} × {formData.totalAttendees} attendee{formData.totalAttendees !== 1 ? 's' : ''}):</span>
                      <span>${mealTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-blue-300">
                    <span className="text-lg font-bold text-primary">Total Amount:</span>
                    <span className="text-2xl font-bold text-primary">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Additional Attendees */}
              {formData.totalAttendees > 1 && (
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-secondary mb-6">Additional Attendees</h2>
                  {formData.additionalAttendees.map((attendee, index) => (
                    <div key={index} className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-lg font-medium text-gray-700 mb-4">Attendee {index + 2}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={attendee.firstName}
                            onChange={(e) => handleAttendeeChange(index, 'firstName', e.target.value)}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={attendee.lastName}
                            onChange={(e) => handleAttendeeChange(index, 'lastName', e.target.value)}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={attendee.email}
                            onChange={(e) => handleAttendeeChange(index, 'email', e.target.value)}
                            required
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Payment Method Selection */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-secondary mb-6">Payment Method</h2>
                <PaymentMethodSelector
                  selectedMethod={paymentMethod}
                  onMethodChange={(method) => {
                    setPaymentMethod(method);
                    // Reset PayPal details when switching methods
                    if (method !== 'paypal') {
                      setPaypalDetails(null);
                    }
                    // Reset Turnstile to ensure a fresh token after payment method selection
                    if (secureFormRef.current) {
                      secureFormRef.current.resetTurnstile();
                    }
                  }}
                  poNumber={poNumber}
                  onPoNumberChange={setPoNumber}
                  amount={totalAmount}
                />

                {/* Missing fields warning for PO/Check */}
                {paymentMethod === 'po' && formValidationErrors.length > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">
                          Please fill in the following required fields before submitting:
                        </p>
                        <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                          {formValidationErrors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* PayPal Button - only show after basic form validation */}
                {paymentMethod === 'paypal' && !paypalDetails && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Complete Payment</h3>
                    {formValidationErrors.length > 0 ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start">
                          <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800">
                              Please fill in the following required fields before proceeding with PayPal payment:
                            </p>
                            <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                              {formValidationErrors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <PayPalButton
                        amount={totalAmount}
                        description={`Tech Conference Registration - ${formData.totalAttendees} attendee(s)${selectedMeals.length > 0 ? ` + ${selectedMeals.length} meal(s)` : ''}`}
                        onSuccess={handlePayPalSuccess}
                        onError={handlePayPalError}
                        onCancel={handlePayPalCancel}
                      />
                    )}
                  </div>
                )}

                {paymentMethod === 'paypal' && paypalDetails && (
                  <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-start">
                      <svg className="h-5 w-5 text-green-400 mt-0.5 mr-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-green-800">Payment Completed!</p>
                        <p className="text-sm text-green-700 mt-1">Transaction ID: {getPayPalTransactionId(paypalDetails)}</p>
                        <p className="text-sm text-green-700">Click "Submit" below to complete your registration.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Hidden input to enable submit button when payment is ready */}
              <input 
                type="hidden" 
                name="paymentReady" 
                value={
                  paymentMethod && 
                  ((paymentMethod === 'po' && poNumber.trim() !== '') || 
                   (paymentMethod === 'paypal' && paypalDetails !== null)) ? 'true' : ''
                }
              />

            </SecureForm>
          </div>
        </section>
      )}
    </div>
  );
};

export default TechConferenceRegistration;