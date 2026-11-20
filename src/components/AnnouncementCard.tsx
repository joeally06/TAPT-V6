import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Paperclip, Pin } from 'lucide-react';
import {
  effectiveDate,
  getAnnouncementCategory,
  getAnnouncementCategoryLabel,
  getAttachmentLabel,
  isNewlyPosted,
  isTrustedAttachmentUrl,
  type AnnouncementCategory
} from '../lib/announcements';
import { formatFileSize } from '../lib/upload';

export interface AnnouncementCardData {
  id: string;
  title: string;
  description: string;
  category: string | null;
  created_at: string;
  publish_at?: string | null;
  is_pinned?: boolean;
  file_url?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

interface AnnouncementCardProps {
  item: AnnouncementCardData;
  // The editor preview shows the card without making it a link.
  preview?: boolean;
}

const CATEGORY_CLASSES: Record<AnnouncementCategory, string> = {
  event: 'bg-blue-100 text-blue-800',
  deadline: 'bg-amber-100 text-amber-900',
  safety: 'bg-red-100 text-red-800',
  general: 'bg-gray-100 text-gray-700'
};

const formatLongDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Big card for the pinned or newest announcement.
export const AnnouncementLead: React.FC<AnnouncementCardProps> = ({ item, preview = false }) => {
  const posted = effectiveDate(item);
  const hasFile = isTrustedAttachmentUrl(item.file_url);
  const readMore = (
    <>
      Read full announcement
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </>
  );

  return (
    <article className="flex h-full flex-col gap-3 rounded-xl bg-tapt-navy p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-white/20 px-2 py-0.5 font-bold uppercase tracking-wide">
          {getAnnouncementCategoryLabel(item.category)}
        </span>
        {item.is_pinned && (
          <span className="inline-flex items-center gap-1">
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
            Pinned
          </span>
        )}
        {isNewlyPosted(item) && <span className="rounded bg-tapt-orange px-2 py-0.5 font-bold text-gray-900">New</span>}
        <time dateTime={posted} className="text-white/85">
          {formatLongDate(posted)}
        </time>
      </div>

      <h3 className="break-words font-heading text-xl font-bold leading-snug text-white sm:text-2xl">{item.title}</h3>
      <p className="line-clamp-6 whitespace-pre-line break-words text-sm leading-relaxed text-white/90">
        {item.description}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
        {hasFile ? (
          <a
            href={item.file_url as string}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25 focus-visible:ring-white focus-visible:ring-offset-0"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            {getAttachmentLabel(item.file_type)}
            {item.file_size ? ` · ${formatFileSize(item.file_size)}` : ''}
          </a>
        ) : (
          <span />
        )}
        {preview ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold">{readMore}</span>
        ) : (
          <Link
            to={`/news/${item.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-bold hover:underline focus-visible:ring-white focus-visible:ring-offset-0"
          >
            {readMore}
          </Link>
        )}
      </div>
    </article>
  );
};

// One line in the compact list beside the lead.
export const AnnouncementRow: React.FC<AnnouncementCardProps> = ({ item, preview = false }) => {
  const posted = effectiveDate(item);
  const date = new Date(posted);
  const category = getAnnouncementCategory(item.category);
  const hasFile = isTrustedAttachmentUrl(item.file_url);

  const content = (
    <>
      <time dateTime={posted} className="w-11 flex-shrink-0 text-center leading-tight">
        <span className="block font-heading text-lg font-bold text-tapt-navy">{date.getDate()}</span>
        <span className="block text-[10px] font-bold uppercase text-gray-500">
          {date.toLocaleDateString('en-US', { month: 'short' })}
        </span>
      </time>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CATEGORY_CLASSES[category]}`}>
            {getAnnouncementCategoryLabel(category)}
          </span>
          {isNewlyPosted(item) && (
            <span className="rounded bg-tapt-orange px-2 py-0.5 text-[10px] font-bold uppercase text-gray-900">New</span>
          )}
        </div>
        <p className="mt-1 break-words text-sm font-semibold text-gray-900">{item.title}</p>
      </div>
      {hasFile && (
        <>
          <Paperclip className="h-4 w-4 flex-shrink-0 text-gray-500" aria-hidden="true" />
          <span className="sr-only">Has an attachment</span>
        </>
      )}
    </>
  );

  const rowClass = 'flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0';

  return preview ? (
    <div className={rowClass}>{content}</div>
  ) : (
    <Link to={`/news/${item.id}`} className={`${rowClass} hover:bg-gray-50`}>
      {content}
    </Link>
  );
};
