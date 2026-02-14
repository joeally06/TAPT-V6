// Resource configuration
const BASE_RESOURCE_URL = import.meta.env.VITE_RESOURCE_BASE_URL || '';
const FALLBACK_RESOURCE_URL = '/resources'; // Fallback to local resources

export const getResourceUrl = (path: string): string => {
  if (!path) {
    throw new Error('Resource path is required');
  }

  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // If we have a base URL configured, use it
  if (BASE_RESOURCE_URL) {
    const baseUrl = BASE_RESOURCE_URL.endsWith('/')
      ? BASE_RESOURCE_URL.slice(0, -1)
      : BASE_RESOURCE_URL;
    return `${baseUrl}/${cleanPath}`;
  }

  // Otherwise use the fallback
  return `${FALLBACK_RESOURCE_URL}/${cleanPath}`;
};

// Resource types configuration
export const ALLOWED_RESOURCE_TYPES = ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX'] as const;
export type ResourceType = typeof ALLOWED_RESOURCE_TYPES[number];

// Resource categories configuration
export const RESOURCE_CATEGORIES = [
  { id: 'all', name: 'All Resources', icon: 'Folder' },
  { id: 'manuals', name: 'Manuals & Guides', icon: 'Book' },
  { id: 'forms', name: 'Forms & Documents', icon: 'FileText' },
  { id: 'laws', name: 'Laws & Regulations', icon: 'FileCheck' },
  { id: 'training', name: 'Training Materials', icon: 'Book' },
  { id: 'safety', name: 'Safety Resources', icon: 'FileCheck' },
  { id: 'links', name: 'External Links', icon: 'ExternalLink' },
] as const;

export type ResourceCategory = typeof RESOURCE_CATEGORIES[number]['id'];

// Resource interface
export interface Resource {
  id: string;
  title: string;
  category: ResourceCategory;
  description: string;
  date: string;
  type: ResourceType;
  size: string;
  path: string;
}
