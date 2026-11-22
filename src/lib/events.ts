// Events are announcements in the "Event" category that carry a date.
// Before the events were merged into announcements they had their own type, so both are read here.

export type EventFormType =
  | 'conference'
  | 'tech-conference'
  | 'regional-luncheon'
  | 'hall-of-fame'
  | 'student-scholarship'
  | 'exhibitor'
  | 'regional-director-nomination'
  | 'president-nomination';

export const EVENT_FORMS: { value: EventFormType; label: string; path: string; actionText: string }[] = [
  { value: 'conference', label: 'Conference Registration', path: '/conference-registration', actionText: 'Register for Conference' },
  { value: 'tech-conference', label: 'Tech Conference Registration', path: '/tech-conference-registration', actionText: 'Register for Tech Conference' },
  { value: 'regional-luncheon', label: 'Regional Luncheon Registration', path: '/regional-luncheon-registration', actionText: 'Register for Regional Luncheon' },
  { value: 'hall-of-fame', label: 'Hall of Fame Nomination', path: '/hall-of-fame-nomination', actionText: 'Submit Nomination' },
  { value: 'student-scholarship', label: 'Student Scholarship Application', path: '/student-scholarship-application', actionText: 'Apply for Scholarship' },
  { value: 'exhibitor', label: 'Exhibitor Registration', path: '/exhibitor-registration', actionText: 'Register as Exhibitor' },
  { value: 'regional-director-nomination', label: 'Regional Director Nomination', path: '/regional-director-nomination', actionText: 'Submit Nomination' },
  { value: 'president-nomination', label: 'President Nomination', path: '/president-nomination', actionText: 'Submit Nomination' }
];

// PostgREST filter for `.or(...)`: an old event row, or an announcement in the Event category that has a date.
export const EVENT_FILTER = 'type.eq.event,and(type.eq.announcement,category.eq.event,date.not.is.null)';

// Same rule as EVENT_FILTER, for a row already loaded.
export const isEventListing = (item: { type: string; category?: string | null; date?: string | null }): boolean =>
  item.type === 'event' || (item.type === 'announcement' && item.category === 'event' && Boolean(item.date));

interface EventLinkFields {
  id: string;
  link?: string | null;
  linked_form_type?: string | null;
}

// A custom link must be a page on this site or an http(s) address; anything else (for example javascript:) is ignored.
const isSafeEventLink = (link: string): boolean =>
  (link.startsWith('/') && !link.startsWith('//') && !/[\s\\]/.test(link)) || link.startsWith('http://') || link.startsWith('https://');

export const findEventForm = (value: string | null | undefined) => EVENT_FORMS.find((form) => form.value === value);

// Where an event's button goes: its form, its own link, or the event page.
export const getEventLink = (event: EventLinkFields): string => {
  const form = findEventForm(event.linked_form_type);
  if (form) return form.path;
  if (event.link && isSafeEventLink(event.link)) return event.link;
  return `/events/${event.id}`;
};

// A custom link to another site opens in a new tab. A linked form is never external.
export const isExternalEventLink = (event: EventLinkFields): boolean =>
  !findEventForm(event.linked_form_type) &&
  Boolean(event.link && (event.link.startsWith('http://') || event.link.startsWith('https://')));

// The button text on event cards
export const getEventButtonText = (event: EventLinkFields, fallback: string): string => {
  if (!event.linked_form_type) return fallback;
  return event.linked_form_type.includes('nomination') ? 'Nominate Now' : 'Register Now';
};
