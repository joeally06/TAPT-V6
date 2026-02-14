import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Mail } from 'lucide-react';

export const TermsOfService: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-tapt-navy text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FileText className="mx-auto mb-4 text-tapt-gold" size={48} />
          <h1 className="text-4xl font-heading font-bold mb-4">Terms of Service</h1>
          <p className="text-gray-200 text-lg">
            Please read these terms carefully before using the TAPT website.
          </p>
          <p className="text-gray-300 text-sm mt-4">Last Updated: February 14, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 space-y-8">

          {/* Agreement */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Agreement to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using the Tennessee Association of Pupil Transportation ("TAPT") website at 
              tapt.org and tntapt.com (the "Website"), you agree to be bound by these Terms of Service 
              ("Terms"). If you do not agree to all of these Terms, you may not access or use the Website. 
              These Terms apply to all visitors, users, members, and others who access or use the Website.
            </p>
          </section>

          {/* About TAPT */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">About TAPT</h2>
            <p className="text-gray-700 leading-relaxed">
              The Tennessee Association of Pupil Transportation is a non-profit professional organization 
              dedicated to promoting safe and efficient student transportation across the state of Tennessee. 
              Our website serves as a resource for transportation professionals, providing information about 
              events, training, membership, and industry resources.
            </p>
          </section>

          {/* Use of Website */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Use of the Website</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              You agree to use the Website only for lawful purposes and in accordance with these Terms. 
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Use the Website in any way that violates applicable federal, state, or local laws or regulations</li>
              <li>Attempt to gain unauthorized access to any part of the Website, other accounts, or computer systems</li>
              <li>Engage in any conduct that restricts or inhibits others from using the Website</li>
              <li>Use any automated system (bots, scrapers, spiders) to access the Website without permission</li>
              <li>Introduce viruses, malware, or other harmful technology</li>
              <li>Submit false, misleading, or fraudulent information through any forms or registration processes</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity</li>
            </ul>
          </section>

          {/* User Accounts */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">User Accounts</h2>
            <p className="text-gray-700 leading-relaxed">
              Certain features of the Website may require you to create an account. You are responsible for 
              maintaining the confidentiality of your account credentials and for all activities under your 
              account. You agree to immediately notify us of any unauthorized use of your account. TAPT 
              reserves the right to suspend or terminate accounts at our discretion for any violation of 
              these Terms.
            </p>
          </section>

          {/* Event Registration */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Event Registration and Payments</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              When you register for conferences, workshops, luncheons, or other TAPT events through our Website:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>You agree to provide accurate and complete registration information</li>
              <li>Registration fees, when applicable, are due at the time of registration</li>
              <li>Payments are processed securely through PayPal and are subject to PayPal's terms of service</li>
              <li>
                Refund and cancellation policies are specific to each event and will be communicated during the 
                registration process. If no specific policy is stated, please contact TAPT directly for refund 
                requests
              </li>
              <li>TAPT reserves the right to cancel or reschedule events, in which case registered participants 
                will be notified and eligible for refunds as applicable</li>
            </ul>
          </section>

          {/* Membership */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Membership</h2>
            <p className="text-gray-700 leading-relaxed">
              TAPT membership is subject to the association's bylaws and membership guidelines. Membership 
              benefits, dues, and renewal terms are established by the TAPT Board of Directors and may be 
              updated periodically. Membership does not guarantee access to all Website features or events, 
              some of which may require separate registration or fees.
            </p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              The Website and its entire contents, features, and functionality — including but not limited to 
              text, graphics, logos, images, photographs, and software — are owned by TAPT or its licensors 
              and are protected by copyright, trademark, and other intellectual property laws. You may not 
              reproduce, distribute, modify, or create derivative works of any content without prior written 
              consent from TAPT. The TAPT name, logo, and all related names, logos, and slogans are trademarks 
              of TAPT.
            </p>
          </section>

          {/* User Content */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">User-Submitted Content</h2>
            <p className="text-gray-700 leading-relaxed">
              When you submit information through our Website — such as contact forms, scholarship applications, 
              Hall of Fame nominations, or event registrations — you grant TAPT a non-exclusive, royalty-free 
              right to use that information for the purposes for which it was submitted. You represent and 
              warrant that any content you submit does not infringe on the rights of any third party and is 
              truthful and accurate.
            </p>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Disclaimers</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              THE WEBSITE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, 
              EITHER EXPRESS OR IMPLIED. TAPT DISCLAIMS ALL WARRANTIES INCLUDING, BUT NOT LIMITED TO, IMPLIED 
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
            <p className="text-gray-700 leading-relaxed">
              TAPT does not warrant that the Website will be uninterrupted, error-free, or free of viruses or 
              other harmful components. Any resources, training materials, safety guidelines, or regulatory 
              information provided on the Website are for informational purposes only and should not be 
              considered legal advice. Users should consult appropriate authorities and professionals for 
              specific guidance.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              TO THE FULLEST EXTENT PERMITTED BY LAW, TAPT AND ITS OFFICERS, DIRECTORS, MEMBERS, EMPLOYEES, 
              AND VOLUNTEERS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR 
              PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF THE WEBSITE, WHETHER BASED ON WARRANTY, 
              CONTRACT, TORT, OR ANY OTHER LEGAL THEORY. IN NO EVENT SHALL TAPT'S TOTAL LIABILITY TO YOU 
              EXCEED THE AMOUNT PAID BY YOU, IF ANY, FOR ACCESSING THE WEBSITE DURING THE TWELVE (12) MONTHS 
              PRECEDING THE CLAIM.
            </p>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Indemnification</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree to defend, indemnify, and hold harmless TAPT, its officers, directors, members, 
              employees, and volunteers from any claims, liabilities, damages, losses, and expenses (including 
              reasonable attorney's fees) arising out of or in any way connected with your access to or use of 
              the Website, your violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          {/* Third-Party Links */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Third-Party Links and Services</h2>
            <p className="text-gray-700 leading-relaxed">
              The Website may contain links to third-party websites, services, or resources that are not owned 
              or controlled by TAPT. We are not responsible for the content, privacy policies, or practices of 
              any third-party websites. Links to external sites do not imply endorsement by TAPT. You 
              acknowledge and agree that TAPT is not liable for any damage or loss caused by or in connection 
              with the use of any third-party content, goods, or services.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the State of 
              Tennessee, without regard to its conflict of law provisions. Any disputes arising under or in 
              connection with these Terms shall be subject to the exclusive jurisdiction of the courts located 
              in the State of Tennessee.
            </p>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Changes to These Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              TAPT reserves the right to modify or replace these Terms at any time at our sole discretion. 
              Changes will be posted on this page with an updated "Last Updated" date. Your continued use of 
              the Website after any changes constitutes acceptance of the new Terms. We encourage you to review 
              these Terms periodically.
            </p>
          </section>

          {/* Severability */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Severability</h2>
            <p className="text-gray-700 leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be 
              limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain 
              in full force and effect.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700 font-semibold">Tennessee Association of Pupil Transportation</p>
              <div className="flex items-center mt-2 text-gray-600">
                <Mail size={16} className="mr-2 text-tapt-gold" />
                <Link to="/contact" className="text-tapt-navy hover:text-tapt-gold underline">
                  Contact Us Online
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
