import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { AnnouncementLead } from '../AnnouncementCard';
import {
  ANNOUNCEMENT_CATEGORIES,
  describeSchedule,
  getAnnouncementCategory,
  getPublishMode,
  getSaveLabel,
  prepareAnnouncementForSave,
  type AnnouncementSaveValues,
  type PublishMode
} from '../../lib/announcements';
import { fromLocalInput, toLocalInput } from '../../lib/datetime';

// The fields of an announcement the editor shows and changes
export interface AnnouncementEditorValues {
  title: string;
  description: string;
  category: string | null;
  status: 'draft' | 'published';
  featured: boolean;
  is_featured: boolean;
  is_pinned: boolean;
  publish_at: string | null;
  expires_at: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
}

interface AnnouncementEditorProps {
  values: Partial<AnnouncementEditorValues>;
  onChange: (changes: Partial<AnnouncementEditorValues>) => void;
  isEditing: boolean;
  // When the announcement was first saved (used for the preview date)
  createdAt?: string;
  // Status the announcement had when the editor opened; null for a new one
  previousStatus: 'draft' | 'published' | null;
  acceptExtensions: string;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  // "Selected: guidelines.pdf (PDF, 640 KB)" for a file chosen now
  selectedFileLabel: string | null;
  // "Current: Document (PDF)" for the file already saved, when there is one
  currentAttachmentLabel: string | null;
  onDeleteAttachment: () => void;
  deletingAttachment: boolean;
  saving: boolean;
  onSubmit: (values: AnnouncementSaveValues) => void;
  onCancel: () => void;
}

const MODES: { value: PublishMode; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' }
];

const FIELD_CLASS = 'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary';
const CARD_CLASS = 'bg-white shadow-md rounded-lg p-5';

// Two-column announcement editor: the text on the left; status, dates, pin and a live preview on the right.
export const AnnouncementEditor: React.FC<AnnouncementEditorProps> = ({
  values,
  onChange,
  isEditing,
  createdAt,
  previousStatus,
  acceptExtensions,
  onFileSelect,
  selectedFileLabel,
  currentAttachmentLabel,
  onDeleteAttachment,
  deletingAttachment,
  saving,
  onSubmit,
  onCancel
}) => {
  const [mode, setMode] = useState<PublishMode>(() =>
    getPublishMode({ status: values.status ?? 'draft', publish_at: values.publish_at })
  );
  const [problem, setProblem] = useState<string | null>(null);

  const now = Date.now();
  const showsOnHome = mode !== 'draft' && Boolean(values.is_featured);

  const changeMode = (next: PublishMode) => {
    setMode(next);
    setProblem(null);
    onChange({ status: next === 'draft' ? 'draft' : 'published' });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = prepareAnnouncementForSave({
      mode,
      is_featured: Boolean(values.is_featured),
      is_pinned: Boolean(values.is_pinned),
      publish_at: values.publish_at ?? null,
      expires_at: values.expires_at ?? null,
      previousStatus
    });
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setProblem(null);
    onSubmit(result.values);
  };

  // The preview shows the date visitors would see
  const previewPublishAt =
    values.publish_at && (mode === 'scheduled' || Date.parse(values.publish_at) <= now) ? values.publish_at : null;

  return (
    <form onSubmit={handleSubmit} className="mb-8" aria-label={isEditing ? 'Edit announcement' : 'Add new announcement'}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-secondary">{isEditing ? 'Edit announcement' : 'Add new announcement'}</h2>
          <p className="text-sm text-gray-500">Content · Announcements</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" aria-hidden="true" />
                {getSaveLabel(mode)}
              </>
            )}
          </button>
        </div>
      </div>

      {problem && (
        <div role="alert" className="mb-4 rounded-md border-l-4 border-red-400 bg-red-50 p-4 text-sm text-red-700">
          {problem}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={`${CARD_CLASS} space-y-5`}>
          <div>
            <label htmlFor="announcementTitle" className="block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="announcementTitle"
              type="text"
              value={values.title ?? ''}
              onChange={(e) => onChange({ title: e.target.value })}
              required
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="announcementCategory" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="announcementCategory"
              value={getAnnouncementCategory(values.category)}
              onChange={(e) => onChange({ category: e.target.value })}
              className={FIELD_CLASS}
            >
              {ANNOUNCEMENT_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="announcementMessage" className="block text-sm font-medium text-gray-700">
              Message
            </label>
            <textarea
              id="announcementMessage"
              value={values.description ?? ''}
              onChange={(e) => onChange({ description: e.target.value })}
              required
              rows={7}
              aria-describedby="announcementMessageHint"
              className={FIELD_CLASS}
            />
            <p id="announcementMessageHint" className="mt-1 text-xs text-gray-500">
              Plain text. Line breaks are kept.
            </p>
          </div>

          <div>
            <label htmlFor="announcementAttachment" className="block text-sm font-medium text-gray-700">
              Attachment (image or document)
            </label>
            <input
              id="announcementAttachment"
              type="file"
              onChange={onFileSelect}
              accept={acceptExtensions}
              aria-describedby="announcementAttachmentHint"
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            <p id="announcementAttachmentHint" className="mt-1 text-xs text-gray-500">
              Supported: PDF, Word, Excel, text files and images.
            </p>
            {selectedFileLabel && <p className="mt-2 text-sm text-green-600">{selectedFileLabel}</p>}
            {!selectedFileLabel && currentAttachmentLabel && (
              <div className="mt-2 flex items-center gap-3">
                <p className="text-sm text-gray-500">{currentAttachmentLabel}</p>
                <button
                  type="button"
                  onClick={onDeleteAttachment}
                  disabled={deletingAttachment}
                  className="inline-flex items-center px-2.5 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                  {deletingAttachment ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${CARD_CLASS} space-y-4`}>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700">Status</legend>
              <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
                {MODES.map((option) => (
                  <label key={option.value} className="relative">
                    <input
                      type="radio"
                      name="announcementStatus"
                      value={option.value}
                      checked={mode === option.value}
                      onChange={() => changeMode(option.value)}
                      className="peer sr-only"
                    />
                    <span className="block cursor-pointer rounded-md px-3 py-2 text-center text-sm font-medium text-gray-600 peer-checked:bg-white peer-checked:text-tapt-navy peer-checked:shadow peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              {mode === 'scheduled' && (
                <div>
                  <label htmlFor="announcementPublishAt" className="block text-sm font-medium text-gray-700">
                    Publish on
                  </label>
                  <input
                    id="announcementPublishAt"
                    type="datetime-local"
                    value={toLocalInput(values.publish_at)}
                    onChange={(e) => onChange({ publish_at: fromLocalInput(e.target.value) })}
                    required
                    className={FIELD_CLASS}
                  />
                </div>
              )}
              <div>
                <label htmlFor="announcementExpiresAt" className="block text-sm font-medium text-gray-700">
                  Remove on <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input
                  id="announcementExpiresAt"
                  type="datetime-local"
                  value={toLocalInput(values.expires_at)}
                  onChange={(e) => onChange({ expires_at: fromLocalInput(e.target.value) })}
                  className={FIELD_CLASS}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="announcementOnHome" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    id="announcementOnHome"
                    type="checkbox"
                    checked={showsOnHome}
                    disabled={mode === 'draft'}
                    onChange={(e) => onChange({ is_featured: e.target.checked, featured: e.target.checked, is_pinned: e.target.checked ? values.is_pinned : false })}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                  />
                  Show on the home page
                </label>
                <p className="mt-1 ml-6 text-xs text-gray-500">
                  {mode === 'draft'
                    ? 'Choose Scheduled or Published first.'
                    : 'Without this it appears on the News page only.'}
                </p>
              </div>

              <div>
                <label htmlFor="announcementPinned" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    id="announcementPinned"
                    type="checkbox"
                    checked={showsOnHome && Boolean(values.is_pinned)}
                    disabled={!showsOnHome}
                    onChange={(e) => onChange({ is_pinned: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                  />
                  Pin to top of home page
                </label>
                <p className="mt-1 ml-6 text-xs text-gray-500">
                  {showsOnHome ? 'Replaces the announcement that is pinned now.' : 'Needs "Show on the home page".'}
                </p>
              </div>
            </div>

            <p role="status" className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {describeSchedule(mode, values.publish_at, values.expires_at, now)}
            </p>
            <p className="text-xs text-gray-500">
              For a notice across the whole site, use{' '}
              <Link to="/admin/site-settings" className="font-medium text-primary underline">
                Site settings, Alert Bar
              </Link>
              .
            </p>
          </div>

          <div className={CARD_CLASS}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview, as visitors see it</p>
            <AnnouncementLead
              preview
              item={{
                id: 'preview',
                title: values.title || 'Your title appears here',
                description: values.description || 'Your message appears here.',
                category: getAnnouncementCategory(values.category),
                created_at: createdAt ?? new Date(now).toISOString(),
                publish_at: previewPublishAt,
                is_pinned: showsOnHome && Boolean(values.is_pinned),
                file_url: values.file_url,
                file_type: values.file_type,
                file_size: values.file_size
              }}
            />
          </div>
        </div>
      </div>
    </form>
  );
};

export default AnnouncementEditor;
