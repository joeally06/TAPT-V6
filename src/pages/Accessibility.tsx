import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Accessibility as AccessibilityIcon, Mail, ArrowRight } from 'lucide-react';

export const Accessibility: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-tapt-navy text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <AccessibilityIcon className="mx-auto mb-4 text-tapt-gold" size={48} />
          <h1 className="text-4xl font-heading font-bold mb-4">Accessibility Statement</h1>
          <p className="text-gray-200 text-lg">
            TAPT is committed to making our website accessible to all users.
          </p>
          <p className="text-gray-300 text-sm mt-4">Last Updated: February 14, 2026</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-8 space-y-8">

          {/* Commitment */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Our Commitment</h2>
            <p className="text-gray-700 leading-relaxed">
              The Tennessee Association of Pupil Transportation (TAPT) is committed to improving the digital 
              accessibility of our website for people of all abilities. We recognize that accessibility is an 
              ongoing effort, and we are actively working to enhance the usability of our website for 
              everyone.
            </p>
          </section>

          {/* Standards */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Accessibility Standards</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We are working toward conformance with the{' '}
              <a 
                href="https://www.w3.org/TR/WCAG21/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-tapt-navy hover:text-tapt-gold underline"
              >
                Web Content Accessibility Guidelines (WCAG) 2.1
              </a>{' '}
              at Level AA. These guidelines explain how to make web content more accessible to people with 
              a wide range of disabilities. While we have not yet completed a full audit against these 
              standards, they serve as our target for ongoing improvements.
            </p>
          </section>

          {/* Current Efforts */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">What We're Doing</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We are taking steps to improve accessibility across our website, including:
            </p>
            <div className="space-y-4">
              <div className="flex items-start">
                <ArrowRight size={20} className="mr-3 mt-1 flex-shrink-0 text-tapt-gold" />
                <div>
                  <h3 className="font-semibold text-gray-800">Responsive Design</h3>
                  <p className="text-gray-600">
                    Our website is built with responsive design, adapting to different screen sizes so content 
                    is usable on desktop computers, tablets, and mobile phones.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <ArrowRight size={20} className="mr-3 mt-1 flex-shrink-0 text-tapt-gold" />
                <div>
                  <h3 className="font-semibold text-gray-800">Structured Content</h3>
                  <p className="text-gray-600">
                    We use HTML headings, lists, and landmarks to help organize content so it is easier 
                    to navigate with assistive technologies.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <ArrowRight size={20} className="mr-3 mt-1 flex-shrink-0 text-tapt-gold" />
                <div>
                  <h3 className="font-semibold text-gray-800">Keyboard Navigation</h3>
                  <p className="text-gray-600">
                    We are working to ensure that links, buttons, and form fields can be reached and 
                    operated using a keyboard. Some interactive elements may still need improvement.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <ArrowRight size={20} className="mr-3 mt-1 flex-shrink-0 text-tapt-gold" />
                <div>
                  <h3 className="font-semibold text-gray-800">Image Descriptions</h3>
                  <p className="text-gray-600">
                    We are adding descriptive alternative text (alt text) to images across the site. Some 
                    images, particularly in photo galleries and older content, may not yet have complete 
                    descriptions.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <ArrowRight size={20} className="mr-3 mt-1 flex-shrink-0 text-tapt-gold" />
                <div>
                  <h3 className="font-semibold text-gray-800">Text Resizing</h3>
                  <p className="text-gray-600">
                    Text on our website can be resized using your browser's built-in zoom functionality 
                    (Ctrl/Cmd + Plus or Minus).
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Known Limitations */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Known Limitations</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              We are aware of the following accessibility limitations and are working to address them:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>
                <strong>Color contrast:</strong> Some text and background color combinations on the site 
                may not yet meet WCAG AA contrast ratio requirements. We are reviewing and updating our 
                color palette.
              </li>
              <li>
                <strong>Focus indicators:</strong> Visible focus outlines may be missing or insufficient on 
                some interactive elements. We are adding consistent focus styles across the site.
              </li>
              <li>
                <strong>Screen reader support:</strong> Some icons, buttons, and links may lack descriptive 
                labels for screen readers. We are adding ARIA labels and roles where needed.
              </li>
              <li>
                <strong>Third-party content:</strong> Embedded content from third-party services 
                (such as payment processors) may not fully meet accessibility standards and is outside 
                our direct control.
              </li>
              <li>
                <strong>PDF documents:</strong> Some downloadable documents may not be fully accessible. 
                If you need information in an alternative format, please contact us.
              </li>
              <li>
                <strong>Photo galleries:</strong> Some images, especially older uploads, may have limited 
                or missing alt text descriptions.
              </li>
            </ul>
          </section>

          {/* Browser Tips */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Tips for Browsing</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Here are some tips that may improve your experience on our website:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>
                <strong>Zoom:</strong> Use your browser's zoom feature (Ctrl/Cmd + Plus or Minus) to increase 
                or decrease text size
              </li>
              <li>
                <strong>High contrast:</strong> Enable your operating system's high contrast mode for 
                improved visibility
              </li>
              <li>
                <strong>Screen reader:</strong> If you use a screen reader, heading navigation (H key in 
                most readers) can help you move through page sections
              </li>
              <li>
                <strong>Tab navigation:</strong> Use the Tab key to move through interactive elements 
                and Enter or Space to activate them
              </li>
            </ul>
          </section>

          {/* Feedback */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Feedback and Assistance</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We welcome your feedback on the accessibility of the TAPT website. If you encounter any 
              accessibility barriers, have difficulty accessing any content, or need information in an 
              alternative format, please let us know. We take accessibility feedback seriously and will 
              make reasonable efforts to address your concerns.
            </p>
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-700 font-semibold">Tennessee Association of Pupil Transportation</p>
              <div className="flex items-center mt-2 text-gray-600">
                <Mail size={16} className="mr-2 text-tapt-gold" />
                <Link to="/contact" className="text-tapt-navy hover:text-tapt-gold underline">
                  Contact Us Online
                </Link>
              </div>
              <p className="text-gray-600 text-sm mt-3">
                When reporting an accessibility issue, please include the page URL, a description of the 
                problem, and the assistive technology you are using (if applicable). We will work to 
                respond to accessibility feedback within 5 business days.
              </p>
            </div>
          </section>

          {/* Continuous Improvement */}
          <section>
            <h2 className="text-2xl font-heading font-bold text-tapt-navy mb-4">Continuous Improvement</h2>
            <p className="text-gray-700 leading-relaxed">
              TAPT is committed to ongoing accessibility improvements. We regularly review our website 
              to identify and remediate accessibility issues. Our goal is to ensure that all users, 
              regardless of ability, can access the information and services provided through our website. 
              This accessibility statement will be updated as improvements are made.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
};

export default Accessibility;
