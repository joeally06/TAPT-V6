import React, { useEffect, useState } from 'react';
import { Calendar, Users, Award, MapPin } from 'lucide-react';
import { getSiteSetting } from '../lib/siteSettings';

export const About: React.FC = () => {
  const [aboutText, setAboutText] = useState<string>('');

  useEffect(() => {
    window.scrollTo(0, 0);
    
    const fetchSettings = async () => {
      try {
        const text = await getSiteSetting('about_text');
        if (text) {
          setAboutText(text);
        }
      } catch (error) {
        console.error('Error fetching about text:', error);
      }
    };
    
    fetchSettings();
  }, []);

  const boardMembers = [
    {
      name: "John Smith",
      title: "President",
      district: "Knox County Schools",
      image: "/src/images/board-members/john-smith.jpg",
      bio: "John has been in school transportation for 20 years and currently serves as Transportation Director for Knox County Schools."
    },
    {
      name: "Sarah Johnson",
      title: "Vice President",
      district: "Metro Nashville Public Schools",
      image: "/src/images/board-members/sarah-johnson.jpg",
      bio: "Sarah oversees transportation for Metro Nashville Public Schools and has been a TAPT member for 12 years."
    },
    {
      name: "Robert Williams",
      title: "Secretary",
      district: "Hamilton County Schools",
      image: "/src/images/board-members/robert-williams.jpg",
      bio: "Robert brings over 15 years of experience in school transportation safety and compliance to the TAPT board."
    },
    {
      name: "Lisa Davis",
      title: "Treasurer",
      district: "Shelby County Schools",
      image: "/src/images/board-members/lisa-davis.jpg",
      bio: "Lisa has a background in finance and has managed transportation budgets for Shelby County Schools for 8 years."
    },
  ];

  const history = [
    {
      year: "1977",
      title: "Founding of TAPT",
      description: "The Tennessee Association of Pupil Transportation was established to represent transportation professionals across the state."
    },
    {
      year: "1985",
      title: "First Annual Conference",
      description: "TAPT held its first annual conference to bring together transportation directors, supervisors, and drivers for networking and education."
    },
    {
      year: "1992",
      title: "State Recognition",
      description: "TAPT was officially recognized by the Tennessee Department of Education as an advisory body for student transportation matters."
    },
    {
      year: "2005",
      title: "Safety Initiative Launch",
      description: "TAPT launched a statewide safety initiative to improve transportation practices and reduce incidents."
    },
    {
      year: "2015",
      title: "Professional Development Program",
      description: "Introduction of a comprehensive professional development certification program for transportation personnel."
    },
    {
      year: "2022",
      title: "Modern Era",
      description: "TAPT continues to serve transportation professionals with expanded resources, advocacy, and networking opportunities."
    }
  ];

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 fade-in">About TAPT</h1>
            <p className="text-xl text-gray-200 mb-8 fade-in">Dedicated to promoting safe and efficient pupil transportation across Tennessee for over 45 years.</p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white p-8 rounded-lg shadow-md border-t-4 border-primary">
              <h2 className="text-2xl font-bold text-secondary mb-4">Our Mission</h2>
              <p className="text-gray-700 leading-relaxed">
                The Tennessee Association of Pupil Transportation serves to promote safe, efficient, and effective transportation for Tennessee students. We support the professional growth of our members through education, advocacy, and networking opportunities.
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-lg shadow-md border-t-4 border-primary">
              <h2 className="text-2xl font-bold text-secondary mb-4">Our Vision</h2>
              <p className="text-gray-700 leading-relaxed">
                TAPT envisions a pupil transportation system that sets the standard for safety, professionalism, and operational excellence. We strive to ensure that every student in Tennessee has access to safe and reliable transportation to and from school.
              </p>
            </div>
          </div>
          
          {/* About Text from Site Settings */}
          {aboutText && (
            <div className="mt-12 bg-white p-8 rounded-lg shadow-md border-t-4 border-primary">
              <h2 className="text-2xl font-bold text-secondary mb-4">About Our Organization</h2>
              <p className="text-gray-700 leading-relaxed">{aboutText}</p>
            </div>
          )}
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-secondary text-center mb-12">Our Core Values</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <div className="bg-primary/10 p-4 rounded-full"><Award className="h-8 w-8 text-primary" /></div>,
                title: "Safety",
                description: "We prioritize the safety of students, maintaining the highest standards in transportation practices."
              },
              {
                icon: <div className="bg-primary/10 p-4 rounded-full"><Users className="h-8 w-8 text-primary" /></div>,
                title: "Professionalism",
                description: "We promote professionalism through training, certification, and ethical standards."
              },
              {
                icon: <div className="bg-primary/10 p-4 rounded-full"><Calendar className="h-8 w-8 text-primary" /></div>,
                title: "Innovation",
                description: "We embrace new technologies and methods that enhance pupil transportation."
              },
              {
                icon: <div className="bg-primary/10 p-4 rounded-full"><MapPin className="h-8 w-8 text-primary" /></div>,
                title: "Advocacy",
                description: "We advocate for policies that support safe and effective student transportation."
              }
            ].map((value, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4">{value.icon}</div>
                  <h3 className="text-xl font-bold text-secondary mb-2">{value.title}</h3>
                  <p className="text-gray-600">{value.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* History Timeline */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-secondary mb-2">Our History</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              For over four decades, TAPT has been at the forefront of pupil transportation in Tennessee.
            </p>
          </div>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-primary/20"></div>
            
            {/* Timeline events */}
            <div className="space-y-12">
              {history.map((event, index) => (
                <div key={index} className={`relative flex items-center ${index % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                  {/* Timeline dot */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-primary"></div>
                  
                  {/* Content */}
                  <div className={`w-5/12 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8'}`}>
                    <div className="bg-white p-6 rounded-lg shadow">
                      <div className="inline-block px-3 py-1 rounded bg-primary/10 text-primary font-bold mb-2">
                        {event.year}
                      </div>
                      <h3 className="text-xl font-bold text-secondary mb-2">{event.title}</h3>
                      <p className="text-gray-600">{event.description}</p>
                    </div>
                  </div>
                  
                  {/* Empty space for alignment */}
                  <div className="w-5/12"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default About;