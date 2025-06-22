import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Award, MapPin, Globe, Mail, ChevronDown, ChevronUp, Search } from 'lucide-react';

interface HallOfFameMember {
  id: string;
  name: string;
  title: string;
  role: string | null;
  organization: string | null;
  location: string | null;
  contact_info: {
    email?: string;
    phone?: string;
  } | null;
  image_url: string | null;
  website: string | null;
  notes: string | null;
  term: string | null;
  induction_year: number;
  achievements: string[];
  bio: string;
}

export const HallOfFameMembers: React.FC = () => {
  const [members, setMembers] = useState<HallOfFameMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBios, setExpandedBios] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get current year for default filter
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [inductionYears, setInductionYears] = useState<number[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('hall_of_fame_members')
        .select('*')
        .order('induction_year', { ascending: false });

      if (error) throw error;

      setMembers(data || []);
      
      // Extract unique induction years
      const years = [...new Set(data?.map(member => member.induction_year) || [])].sort((a, b) => b - a);
      setInductionYears(years);
      
      // If current year isn't in the list, default to most recent year
      if (years.length > 0 && !years.includes(currentYear)) {
        setSelectedYear(years[0]);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      setError('Failed to load Hall of Fame members');
    } finally {
      setLoading(false);
    }
  };

  const toggleBio = (memberId: string) => {
    setExpandedBios(prev => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };
  
  // Filter members based on selected year and search term
  const filteredMembers = members.filter(member => {
    const matchesYear = selectedYear === 'all' || member.induction_year === selectedYear;
    
    const matchesSearch = searchTerm === '' || 
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.organization && member.organization.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (member.bio && member.bio.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesYear && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16">
      {/* Hero Section */}
      <section className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Hall of Fame</h1>
            <p className="text-xl text-gray-200">
              Honoring excellence in pupil transportation across Tennessee.
            </p>
          </div>
        </div>
      </section>

      {/* Filter Section */}
      <section className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <span className="text-gray-700 font-medium">Filter by Year:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              >
                <option value="all">All Years</option>
                {inductionYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Members Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Members Found</h3>
              <p className="mt-1 text-gray-500">
                {selectedYear === 'all' 
                  ? 'There are no Hall of Fame members in the database.' 
                  : `There are no Hall of Fame members for the year ${selectedYear}.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredMembers.map((member) => (
                <div key={member.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all">
                  {member.image_url ? (
                    <img 
                      src={member.image_url} 
                      alt={member.name}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                      <Award className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-secondary">{member.name}</h3>
                      <p className="text-primary font-medium">{member.title}</p>
                      {member.organization && (
                        <p className="text-gray-600">{member.organization}</p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      {member.location && (
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          <span>{member.location}</span>
                        </div>
                      )}
                      {member.contact_info?.email && (
                        <div className="flex items-center">
                          <Mail className="h-4 w-4 mr-2" />
                          <a href={`mailto:${member.contact_info.email}`} className="hover:text-primary">
                            {member.contact_info.email}
                          </a>
                        </div>
                      )}
                      {member.website && (
                        <div className="flex items-center">
                          <Globe className="h-4 w-4 mr-2" />
                          <a href={member.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                            Visit Website
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Achievements</h4>
                      <ul className="list-disc list-inside text-gray-600 space-y-1">
                        {member.achievements.map((achievement, index) => (
                          <li key={index}>{achievement}</li>
                        ))}
                      </ul>
                    </div>

                    <details 
                      className="group mt-4" 
                      open={expandedBios[member.id] || false}
                      onClick={(e) => {
                        e.preventDefault(); // Prevent default toggle behavior
                        toggleBio(member.id);
                      }}
                    >
                      <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-gray-900 mb-2">
                        <span>Biography</span>
                        <span className="transition-transform duration-200">
                          {expandedBios[member.id] ? (
                            <ChevronUp className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          )}
                        </span>
                      </summary>
                      <div className={`mt-2 text-gray-600 overflow-hidden transition-all duration-300 ${
                        expandedBios[member.id] ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                      }`}>
                        <p>{member.bio}</p>
                      </div>
                    </details>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-500">
                        Inducted: {member.induction_year}
                        {member.term && ` • ${member.term}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default HallOfFameMembers;