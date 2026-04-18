import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Mail, Phone, Building, Clock, Award, AlertTriangle } from 'lucide-react';
import { SecureForm } from '../components/forms/SecureForm';
import { SuccessModal } from '../components/ui/SuccessModal';

interface RegionalDirectorSettings {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description: string;
  nomination_instructions: string;
  is_active: boolean;
}

const REGIONS = [
  { value: '', label: 'Select Region' },
  { value: 'West', label: 'West Tennessee' },
  { value: 'Middle', label: 'Middle Tennessee' },
  { value: 'East', label: 'East Tennessee' }
];

const NOMINATOR_TITLES = [
  { value: '', label: 'Select Title' },
  { value: 'Director of Schools', label: 'Director of Schools' },
  { value: 'District Pupil Transportation Supervisor', label: 'District Pupil Transportation Supervisor' },
  { value: 'Pupil Transportation Staff Member', label: 'Pupil Transportation Staff Member' }
];

export const RegionalDirectorNomination: React.FC = () => {
  const [formData, setFormData] = useState({
    candidateFirstName: '',
    candidateLastName: '',
    candidateTitle: '',
    candidateSchoolDistrict: '',
    candidateRegion: '',
    candidatePhone: '',
    candidateEmail: '',
    nominatorFirstName: '',
    nominatorLastName: '',
    nominatorTitle: '',
    nominatorSchoolDistrict: '',
    nominatorEmail: '',
    nominatorPhone: '',
    nominatorCertification: false,
    activeMemberGoodStanding: false,
    affiliatedWithDistrictInRegion: false,
    districtApprovalAndSupport: false,
    travelExpensesAssumed: false,
    commitsToThreeYearTerm: false,
    impartialRegardingVendors: false,
    candidateCertification: false,
    candidateSignatureName: '',
    candidateSignatureDate: '',
  });

  const [settings, setSettings] = useState<RegionalDirectorSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNominationPeriodOpen, setIsNominationPeriodOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalContent, setSuccessModalContent] = useState({
    title: 'Nomination Submitted!',
    message: '',
    subMessage: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('regional_director_nomination_settings')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        setError('Failed to load settings. Please try again later.');
        return;
      }

      if (!data) {
        setError('No active nomination period is available at this time.');
        return;
      }

      setSettings(data);

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const startDateStr = data.start_date.includes('T') ? data.start_date.split('T')[0] : data.start_date;
      const [y1, m1, d1] = startDateStr.split('-').map(Number);
      const startDate = new Date(y1, m1 - 1, d1);

      const endDateStr = data.end_date.includes('T') ? data.end_date.split('T')[0] : data.end_date;
      const [y2, m2, d2] = endDateStr.split('-').map(Number);
      const endDate = new Date(y2, m2 - 1, d2);

      if (now < startDate) {
        setIsNominationPeriodOpen(false);
        setError(`Nominations open on ${startDate.toLocaleDateString()}`);
      } else if (now > endDate) {
        setIsNominationPeriodOpen(false);
        setError(`Nominations closed on ${endDate.toLocaleDateString()}`);
      } else {
        setIsNominationPeriodOpen(true);
        setError(null);
      }
    } catch {
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getNominationPeriodDisplay = () => {
    if (!settings?.start_date || !settings?.end_date) return '';
    const startDateStr = settings.start_date.includes('T') ? settings.start_date.split('T')[0] : settings.start_date;
    const [y1, m1, d1] = startDateStr.split('-').map(Number);
    const endDateStr = settings.end_date.includes('T') ? settings.end_date.split('T')[0] : settings.end_date;
    const [y2, m2, d2] = endDateStr.split('-').map(Number);
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'candidatePhone' || name === 'nominatorPhone') {
      const numbersOnly = value.replace(/\D/g, '').slice(0, 10);
      setFormData(prev => ({ ...prev, [name]: numbersOnly }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const isFormValid = () => {
    return (
      formData.candidateFirstName.trim() &&
      formData.candidateLastName.trim() &&
      formData.candidateSchoolDistrict.trim() &&
      formData.candidateRegion &&
      formData.candidatePhone.length === 10 &&
      formData.candidateEmail.trim() &&
      formData.nominatorFirstName.trim() &&
      formData.nominatorLastName.trim() &&
      formData.nominatorTitle &&
      formData.nominatorSchoolDistrict.trim() &&
      formData.nominatorEmail.trim() &&
      formData.nominatorPhone.length === 10 &&
      formData.nominatorCertification &&
      formData.activeMemberGoodStanding &&
      formData.affiliatedWithDistrictInRegion &&
      formData.districtApprovalAndSupport &&
      formData.travelExpensesAssumed &&
      formData.commitsToThreeYearTerm &&
      formData.impartialRegardingVendors &&
      formData.candidateCertification &&
      formData.candidateSignatureName.trim() &&
      formData.candidateSignatureDate
    );
  };

  const handleSecureSubmit = async (_formData: any, _isVerified: boolean, turnstileToken: string) => {
    if (!settings?.is_active) throw new Error('Nominations are currently closed.');
    if (!isNominationPeriodOpen) throw new Error('The nomination period is not currently open.');
    if (!isFormValid()) throw new Error('Please complete all required fields and attestations.');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('Configuration error. Please contact support.');

    const response = await fetch(
      `${supabaseUrl}/functions/v1/submit-regional-director-nomination`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          candidate_first_name: formData.candidateFirstName,
          candidate_last_name: formData.candidateLastName,
          candidate_title: formData.candidateTitle,
          candidate_school_district: formData.candidateSchoolDistrict,
          candidate_region: formData.candidateRegion,
          candidate_phone: formData.candidatePhone,
          candidate_email: formData.candidateEmail,
          nominator_first_name: formData.nominatorFirstName,
          nominator_last_name: formData.nominatorLastName,
          nominator_title: formData.nominatorTitle,
          nominator_school_district: formData.nominatorSchoolDistrict,
          nominator_email: formData.nominatorEmail,
          nominator_phone: formData.nominatorPhone,
          nominator_certification: formData.nominatorCertification,
          active_member_good_standing: formData.activeMemberGoodStanding,
          affiliated_with_district_in_region: formData.affiliatedWithDistrictInRegion,
          district_approval_and_support: formData.districtApprovalAndSupport,
          travel_expenses_assumed: formData.travelExpensesAssumed,
          commits_to_three_year_term: formData.commitsToThreeYearTerm,
          impartial_regarding_vendors: formData.impartialRegardingVendors,
          candidate_certification: formData.candidateCertification,
          candidate_signature_name: formData.candidateSignatureName,
          candidate_signature_date: formData.candidateSignatureDate,
          turnstileToken
        }),
      }
    );

    let result;
    try { result = await response.json(); } catch { throw new Error('Server communication error. Please try again.'); }
    if (!response.ok) throw new Error(result?.error || `Server error (${response.status}).`);

    setSuccessModalContent({
      title: 'Nomination Submitted!',
      message: 'Your Regional Director / Board Member nomination has been successfully received.',
      subMessage: 'A confirmation email has been sent to the nominator. TAPT will review the nomination and follow up as needed.'
    });
    setShowSuccessModal(true);

    // Reset form
    setFormData({
      candidateFirstName: '', candidateLastName: '', candidateTitle: '',
      candidateSchoolDistrict: '', candidateRegion: '', candidatePhone: '', candidateEmail: '',
      nominatorFirstName: '', nominatorLastName: '', nominatorTitle: '',
      nominatorSchoolDistrict: '', nominatorEmail: '', nominatorPhone: '',
      nominatorCertification: false, activeMemberGoodStanding: false,
      affiliatedWithDistrictInRegion: false, districtApprovalAndSupport: false,
      travelExpensesAssumed: false, commitsToThreeYearTerm: false,
      impartialRegardingVendors: false, candidateCertification: false,
      candidateSignatureName: '', candidateSignatureDate: '',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Award className="mx-auto h-16 w-16 text-primary" />
            <h1 className="mt-4 text-3xl font-bold text-gray-900">
              TAPT Regional Director / Board Member Nomination
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              Tennessee Association of Pupil Transportation
            </p>
            {settings && (
              <div className="mt-4 inline-flex items-center px-4 py-2 bg-primary/10 rounded-full">
                <Clock className="h-5 w-5 text-primary mr-2" />
                <span className="text-sm font-medium text-primary">
                  Nomination Period: {getNominationPeriodDisplay()}
                </span>
              </div>
            )}
          </div>

          {/* Error / Closed State */}
          {error && (
            <div className="mb-8 bg-amber-50 border-l-4 border-amber-400 p-6 rounded-r-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-6 w-6 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-amber-800">Nomination Period Notice</h3>
                  <p className="mt-1 text-amber-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {settings?.description && isNominationPeriodOpen && (
            <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
              <p className="text-gray-700">{settings.description}</p>
            </div>
          )}

          {/* Instructions */}
          {settings?.nomination_instructions && isNominationPeriodOpen && (
            <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Instructions</h3>
              <p className="text-blue-800 whitespace-pre-wrap">{settings.nomination_instructions}</p>
            </div>
          )}

          {/* Form */}
          {isNominationPeriodOpen && (
            <SecureForm
              onSubmit={handleSecureSubmit}
              submitText="Submit Nomination"
              className="space-y-8"
            >
              {/* Candidate Information */}
              <div className="bg-white shadow-lg rounded-lg p-6">
                <h2 className="text-xl font-bold text-secondary mb-6 flex items-center">
                  <User className="h-6 w-6 mr-2" />
                  Candidate Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="candidateFirstName" className="block text-sm font-medium text-gray-700">First Name *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="text" id="candidateFirstName" name="candidateFirstName" value={formData.candidateFirstName} onChange={handleChange} required
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="candidateLastName" className="block text-sm font-medium text-gray-700">Last Name *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="text" id="candidateLastName" name="candidateLastName" value={formData.candidateLastName} onChange={handleChange} required
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="candidateTitle" className="block text-sm font-medium text-gray-700">Title</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Award className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="text" id="candidateTitle" name="candidateTitle" value={formData.candidateTitle} onChange={handleChange}
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="candidateSchoolDistrict" className="block text-sm font-medium text-gray-700">School District *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="text" id="candidateSchoolDistrict" name="candidateSchoolDistrict" value={formData.candidateSchoolDistrict} onChange={handleChange} required
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="candidateRegion" className="block text-sm font-medium text-gray-700">Region *</label>
                    <select id="candidateRegion" name="candidateRegion" value={formData.candidateRegion} onChange={handleChange} required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary">
                      {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="candidatePhone" className="block text-sm font-medium text-gray-700">Phone *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="tel" id="candidatePhone" name="candidatePhone" value={formData.candidatePhone} onChange={handleChange} required placeholder="1234567890"
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                    {formData.candidatePhone && formData.candidatePhone.length < 10 && (
                      <p className="mt-1 text-xs text-red-600">Phone number must be 10 digits</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="candidateEmail" className="block text-sm font-medium text-gray-700">Email *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="email" id="candidateEmail" name="candidateEmail" value={formData.candidateEmail} onChange={handleChange} required
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Nominator Information */}
              <div className="bg-white shadow-lg rounded-lg p-6">
                <h2 className="text-xl font-bold text-secondary mb-6 flex items-center">
                  <User className="h-6 w-6 mr-2" />
                  Nominator Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="nominatorFirstName" className="block text-sm font-medium text-gray-700">First Name *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="text" id="nominatorFirstName" name="nominatorFirstName" value={formData.nominatorFirstName} onChange={handleChange} required
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="nominatorLastName" className="block text-sm font-medium text-gray-700">Last Name *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="text" id="nominatorLastName" name="nominatorLastName" value={formData.nominatorLastName} onChange={handleChange} required
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="nominatorTitle" className="block text-sm font-medium text-gray-700">Title *</label>
                    <select id="nominatorTitle" name="nominatorTitle" value={formData.nominatorTitle} onChange={handleChange} required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary">
                      {NOMINATOR_TITLES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="nominatorSchoolDistrict" className="block text-sm font-medium text-gray-700">School District *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="text" id="nominatorSchoolDistrict" name="nominatorSchoolDistrict" value={formData.nominatorSchoolDistrict} onChange={handleChange} required
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="nominatorEmail" className="block text-sm font-medium text-gray-700">Email *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="email" id="nominatorEmail" name="nominatorEmail" value={formData.nominatorEmail} onChange={handleChange} required
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="nominatorPhone" className="block text-sm font-medium text-gray-700">Phone *</label>
                    <div className="mt-1 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="tel" id="nominatorPhone" name="nominatorPhone" value={formData.nominatorPhone} onChange={handleChange} required placeholder="1234567890"
                        className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                    </div>
                    {formData.nominatorPhone && formData.nominatorPhone.length < 10 && (
                      <p className="mt-1 text-xs text-red-600">Phone number must be 10 digits</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Attestations */}
              <div className="bg-white shadow-lg rounded-lg p-6">
                <h2 className="text-xl font-bold text-secondary mb-4 flex items-center">
                  <Award className="h-6 w-6 mr-2" />
                  Certifications & Attestations
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  All items must be checked to proceed with the nomination.
                </p>
                <div className="space-y-4">
                  {[
                    { name: 'nominatorCertification', label: 'I certify that the information provided in this nomination is accurate and complete' },
                    { name: 'activeMemberGoodStanding', label: 'The candidate is an active member in good standing of TAPT' },
                    { name: 'affiliatedWithDistrictInRegion', label: 'The candidate is affiliated with a school district within the nominated region' },
                    { name: 'districtApprovalAndSupport', label: 'The candidate has the approval and support of their school district' },
                    { name: 'travelExpensesAssumed', label: 'Travel expenses for board meetings and conferences will be assumed by the candidate or their district' },
                    { name: 'commitsToThreeYearTerm', label: 'The candidate commits to serving a three-year term as Regional Director' },
                    { name: 'impartialRegardingVendors', label: 'The candidate will remain impartial regarding vendors and commercial interests' },
                    { name: 'candidateCertification', label: 'The candidate certifies they have reviewed and agree to all commitments listed above' },
                  ].map(({ name, label }) => (
                    <label key={name} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors">
                      <input
                        type="checkbox"
                        name={name}
                        checked={(formData as any)[name]}
                        onChange={handleChange}
                        className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Candidate Signature */}
              <div className="bg-white shadow-lg rounded-lg p-6">
                <h2 className="text-xl font-bold text-secondary mb-6 flex items-center">
                  <Award className="h-6 w-6 mr-2" />
                  Candidate Signature
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  By typing your name below, you certify that you agree to the commitments listed above if elected.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="candidateSignatureName" className="block text-sm font-medium text-gray-700">Full Name (Typed Signature) *</label>
                    <input type="text" id="candidateSignatureName" name="candidateSignatureName" value={formData.candidateSignatureName} onChange={handleChange} required
                      placeholder="Type your full name as signature"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary italic" />
                  </div>
                  <div>
                    <label htmlFor="candidateSignatureDate" className="block text-sm font-medium text-gray-700">Date *</label>
                    <input type="date" id="candidateSignatureDate" name="candidateSignatureDate" value={formData.candidateSignatureDate} onChange={handleChange} required
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
                  </div>
                </div>
              </div>
            </SecureForm>
          )}
        </div>
      </div>

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successModalContent.title}
        message={successModalContent.message}
        subMessage={successModalContent.subMessage}
      />
    </>
  );
};

export default RegionalDirectorNomination;
