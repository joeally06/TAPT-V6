import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, ExternalLink, Paperclip } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  effectiveDate,
  getAnnouncementCategoryLabel,
  getAttachmentLabel,
  isTrustedAttachmentUrl
} from '../lib/announcements';
import { formatFileSize } from '../lib/upload';

interface NewsRecord {
  id: string;
  title: string;
  description: string;
  type: string;
  category: string | null;
  image_url: string | null;
  link: string | null;
  created_at: string;
  date: string | null;
  publish_at: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same image hosts the event page allows
const isTrustedImageUrl = (url: string | null): url is string => {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === 'https:' &&
      (hostname.endsWith('.supabase.co') ||
        hostname === 'pexels.com' ||
        hostname.endsWith('.pexels.com') ||
        hostname === 'images.unsplash.com')
    );
  } catch {
    return false;
  }
};

const isExternalLink = (url: string): boolean => url.startsWith('http://') || url.startsWith('https://');

// A page on this site, such as /conference-registration. Anything else that is not http(s) is not shown.
const isInternalLink = (url: string): boolean =>
  url.startsWith('/') && !url.startsWith('//') && !/[\s\\]/.test(url);

export const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<NewsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchItem = async () => {
      setLoading(true);
      setError(null);
      setItem(null);

      if (!id || !UUID_PATTERN.test(id)) {
        setError('This page could not be found.');
        setLoading(false);
        return;
      }

      // Only published items come back: the database also hides items scheduled for later.
      const { data, error: fetchError } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .in('type', ['news', 'announcement'])
        .eq('status', 'published')
        .maybeSingle();

      if (fetchError) {
        console.error('Error loading news item:', fetchError);
        setError('We could not load this page. Please try again later.');
      } else if (!data) {
        setError('This page could not be found. It may have been removed.');
      } else {
        setItem(data as NewsRecord);
      }
      setLoading(false);
    };

    fetchItem();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-b-4 border-t-4 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-lg bg-white p-8 shadow-md">
          <p role="alert" className="mb-6 border-l-4 border-red-400 bg-red-50 p-4 text-sm text-red-700">
            {error || 'This page could not be found.'}
          </p>
          <Link to="/news" className="inline-flex items-center font-medium text-primary hover:text-primary/80">
            <ArrowLeft className="mr-2 h-5 w-5" aria-hidden="true" />
            Back to News
          </Link>
        </div>
      </div>
    );
  }

  const posted = item.type === 'announcement' ? effectiveDate(item) : item.date || item.created_at;
  const categoryLabel = getAnnouncementCategoryLabel(item.category);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-3xl px-4">
        <Link to="/news" className="mb-6 inline-flex items-center font-medium text-primary hover:text-primary/80">
          <ArrowLeft className="mr-2 h-5 w-5" aria-hidden="true" />
          Back to News
        </Link>

        <article className="overflow-hidden rounded-lg bg-white shadow-lg">
          {isTrustedImageUrl(item.image_url) && (
            <img src={item.image_url} alt="" className="h-64 w-full object-cover md:h-80" />
          )}

          <div className="p-6 md:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
              {categoryLabel && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                  {categoryLabel}
                </span>
              )}
              <span className="inline-flex items-center">
                <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                <time dateTime={posted}>
                  {new Date(posted).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>
              </span>
            </div>

            <h1 className="mb-6 break-words text-3xl font-bold md:text-4xl">{item.title}</h1>

            <p className="whitespace-pre-line break-words text-lg leading-relaxed text-gray-700">{item.description}</p>

            {(isTrustedAttachmentUrl(item.file_url) ||
              (item.link && (isExternalLink(item.link) || isInternalLink(item.link)))) && (
              <div className="mt-8 flex flex-wrap gap-3 border-t pt-6">
                {isTrustedAttachmentUrl(item.file_url) && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg bg-primary px-5 py-3 font-medium text-white hover:bg-primary/90"
                  >
                    <Paperclip className="mr-2 h-5 w-5" aria-hidden="true" />
                    {getAttachmentLabel(item.file_type)}
                    {item.file_size ? ` · ${formatFileSize(item.file_size)}` : ''}
                  </a>
                )}
                {item.link && isExternalLink(item.link) && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg border border-primary px-5 py-3 font-medium text-primary hover:bg-primary/5"
                  >
                    Learn more
                    <ExternalLink className="ml-2 h-5 w-5" aria-hidden="true" />
                  </a>
                )}
                {item.link && isInternalLink(item.link) && (
                  <Link
                    to={item.link}
                    className="inline-flex items-center rounded-lg border border-primary px-5 py-3 font-medium text-primary hover:bg-primary/5"
                  >
                    Learn more
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
          </div>
        </article>
      </div>
    </div>
  );
};

export default NewsDetail;
