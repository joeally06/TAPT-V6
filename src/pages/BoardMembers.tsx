import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Building, Mail, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPublicUrl } from '../lib/storage';

interface BoardMember {
  id: string;
  name: string;
  title: string;
  district: string | null;
  bio: string | null;
  image: string | null;
  order: number;
}

export const BoardMembers: React.FC = () => {
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('board_members')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;

      setMembers(data || []);
    } catch (error: any) {
      console.error('Error fetching board members:', error);
      setError('Failed to load board members');
    } finally {
      setLoading(false);
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
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Board of Directors</h1>
            <p className="text-xl text-gray-200">
              Meet the dedicated professionals who lead the Tennessee Association of Pupil Transportation.
            </p>
          </div>
        </div>
      </section>

      {/* Board Members Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {error ? (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-red-700">{error}</p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No board members found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {members.map((member) => {
                // Ensure correct path for 'public' bucket with 'board-members/' folder
                let cleanImage = member.image ? member.image.replace(/^board-members\//, '') : null;
                const imageUrl = cleanImage ? getPublicUrl('public', `board-members/${cleanImage}`) : null;
                console.log('Board member image URL:', imageUrl, 'for', member.name, 'image field:', member.image);
                return (
                  <div key={member.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all">
                    {imageUrl ? (
                      <div className="w-full h-64 bg-gradient-to-br from-tapt-blue/5 to-tapt-navy/5 flex items-center justify-center">
                        <img 
                          src={imageUrl}
                          alt={member.name}
                          className="w-full h-full object-contain p-2"
                          onError={e => { (e.target as HTMLImageElement).src = '/images/board-members/default.png'; }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-64 bg-gradient-to-br from-tapt-blue/5 to-tapt-navy/5 flex items-center justify-center">
                        <Building className="h-14 w-14 text-gray-400" />
                      </div>
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-tapt-navy">{member.name}</h3>
                      <p className="text-tapt-blue font-medium">{member.title}</p>
                      {member.district && (
                        <div className="flex items-center mt-2 text-gray-600">
                          <MapPin className="h-4 w-4 mr-2" />
                          <span>{member.district}</span>
                        </div>
                      )}
                      {member.bio && (
                        <p className="mt-4 text-gray-600">{member.bio}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-secondary mb-4">Get in Touch</h2>
            <p className="text-gray-600 max-w-2xl mx-auto mb-8">
              Have questions for our board members? Contact us and we'll connect you with the appropriate person.
            </p>
            <Link
              to="/contact"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BoardMembers;