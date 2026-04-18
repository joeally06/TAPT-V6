import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, ArrowLeft, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DOMPurify from 'dompurify';

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  image_url: string | null;
  link: string | null;
  linked_form_type: string | null;
  status: string;
  type: string;
  created_at: string;
}

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchEvent();
  }, [id]);

  // Validate UUID format to prevent SQL injection
  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  // Validate image URL is from Supabase storage
  const isValidImageUrl = (url: string | null): boolean => {
    if (!url) return true;
    
    try {
      const urlObj = new URL(url);
      // Allow Supabase storage URLs and Pexels (used in the app)
      return urlObj.hostname.includes('supabase.co') || 
             urlObj.hostname.includes('pexels.com') ||
             urlObj.hostname === 'images.unsplash.com';
    } catch {
      return false;
    }
  };

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate event ID format
      if (!id || !isValidUUID(id)) {
        setError('Invalid event identifier');
        setLoading(false);
        return;
      }

      // Query with security filters - only published events
      const { data, error: fetchError } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .eq('type', 'event')
        .eq('status', 'published')
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Event not found or no longer available');
        } else {
          // Don't expose internal error details
          setError('Unable to load event');
          console.error('Error fetching event:', fetchError);
        }
        setLoading(false);
        return;
      }

      // Validate image URL before setting state
      if (data.image_url && !isValidImageUrl(data.image_url)) {
        console.warn('Invalid image URL detected, removing from display');
        data.image_url = null;
      }

      setEvent(data);
    } catch (err: any) {
      // Generic error without exposing details
      setError('An unexpected error occurred');
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sanitize text content to prevent XSS
  const sanitizeText = (text: string): string => {
    return DOMPurify.sanitize(text, { 
      ALLOWED_TAGS: [], // Strip all HTML tags
      KEEP_CONTENT: true // Keep text content
    });
  };

  // Get the link for registration/external links
  const getActionLink = (): { href: string; text: string; isExternal: boolean } | null => {
    if (!event) return null;

    if (event.linked_form_type) {
      switch (event.linked_form_type) {
        case 'conference':
          return { href: '/conference-registration', text: 'Register for Conference', isExternal: false };
        case 'tech-conference':
          return { href: '/tech-conference-registration', text: 'Register for Tech Conference', isExternal: false };
        case 'hall-of-fame':
          return { href: '/hall-of-fame-nomination', text: 'Submit Nomination', isExternal: false };
        case 'student-scholarship':
          return { href: '/student-scholarship-application', text: 'Apply for Scholarship', isExternal: false };
        case 'regional-director-nomination':
          return { href: '/regional-director-nomination', text: 'Submit Nomination', isExternal: false };
        case 'president-nomination':
          return { href: '/president-nomination', text: 'Submit Nomination', isExternal: false };
        default:
          return null;
      }
    }

    if (event.link) {
      const isExternal = event.link.startsWith('http://') || event.link.startsWith('https://');
      return { 
        href: event.link, 
        text: 'Learn More', 
        isExternal 
      };
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-b-4 border-primary rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 bg-gray-50 min-h-screen">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error || 'Event not found'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-primary hover:text-primary/80 font-medium"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const actionLink = getActionLink();

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-primary hover:text-primary/80 font-medium mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Home
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {event.image_url && (
            <div className="relative h-64 md:h-96 overflow-hidden">
              <img
                src={event.image_url}
                alt={sanitizeText(event.title)}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="p-6 md:p-8">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 mb-4">
                Featured Event
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {sanitizeText(event.title)}
              </h1>
            </div>

            <div className="flex flex-wrap gap-4 mb-6 text-gray-600">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm md:text-base">
                  {new Date(event.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="prose max-w-none mb-8">
              <p className="text-lg text-gray-700 whitespace-pre-wrap leading-relaxed">
                {sanitizeText(event.description)}
              </p>
            </div>

            {actionLink && (
              <div className="border-t pt-6">
                {actionLink.isExternal ? (
                  <a
                    href={actionLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    {actionLink.text}
                    <ExternalLink className="ml-2 h-5 w-5" />
                  </a>
                ) : (
                  <Link
                    to={actionLink.href}
                    className="inline-flex items-center bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
                  >
                    {actionLink.text}
                    <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <Link
            to="/events"
            className="text-primary hover:text-primary/80 font-medium inline-flex items-center"
          >
            View All Events
            <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default EventDetail;
