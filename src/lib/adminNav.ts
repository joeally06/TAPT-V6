import {
  Archive,
  Award,
  Calendar,
  DollarSign,
  GraduationCap,
  Image,
  Inbox,
  Laptop,
  LayoutDashboard,
  Newspaper,
  Settings,
  Store,
  Trophy,
  UserCog,
  Users,
  Utensils,
  Vote,
  type LucideIcon
} from 'lucide-react';

// Which "waiting" count (see adminCounts.ts) a menu item shows as a badge.
export type NavCountKey = 'scholarships' | 'hallOfFame' | 'boardNominations' | 'messages' | 'memberships';

export interface NavLeaf {
  name: string;
  path: string;
}

export interface NavItem {
  name: string;
  icon: LucideIcon;
  // An item has either its own page or a list of pages beneath it.
  path?: string;
  children?: NavLeaf[];
  count?: NavCountKey;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    label: null,
    items: [{ name: 'Dashboard', icon: LayoutDashboard, path: '/admin' }]
  },
  {
    label: 'Events & programs',
    items: [
      {
        name: 'Annual Conference',
        icon: Calendar,
        children: [
          { name: 'Registrations', path: '/admin/conference-registrations' },
          { name: 'Settings', path: '/admin/conference-settings' }
        ]
      },
      {
        name: 'Tech Conference',
        icon: Laptop,
        children: [
          { name: 'Registrations', path: '/admin/tech-conference-registrations' },
          { name: 'Settings', path: '/admin/tech-conference-settings' }
        ]
      },
      {
        name: 'Regional Luncheon',
        icon: Utensils,
        children: [
          { name: 'Registrations', path: '/admin/regional-luncheon-registrations' },
          { name: 'Settings', path: '/admin/regional-luncheon-settings' }
        ]
      },
      {
        name: 'Exhibitors',
        icon: Store,
        children: [
          { name: 'Registrations', path: '/admin/exhibitor-registrations' },
          { name: 'Settings', path: '/admin/exhibitor-settings' }
        ]
      },
      {
        name: 'Scholarships',
        icon: GraduationCap,
        count: 'scholarships',
        children: [
          { name: 'Applications', path: '/admin/student-scholarship-applications' },
          { name: 'Settings', path: '/admin/student-scholarship-settings' }
        ]
      }
    ]
  },
  {
    label: 'Recognition',
    items: [
      {
        name: 'Hall of Fame',
        icon: Trophy,
        count: 'hallOfFame',
        children: [
          { name: 'Nominations', path: '/admin/hall-of-fame-nominations' },
          { name: 'Members', path: '/admin/hall-of-fame-members' },
          { name: 'Settings', path: '/admin/hall-of-fame-settings' }
        ]
      },
      {
        name: 'Board nominations',
        icon: Vote,
        count: 'boardNominations',
        children: [
          { name: 'Regional Director', path: '/admin/regional-director-nominations' },
          { name: 'Regional Director settings', path: '/admin/regional-director-nomination-settings' },
          { name: 'President', path: '/admin/president-nominations' },
          { name: 'President settings', path: '/admin/president-nomination-settings' }
        ]
      }
    ]
  },
  {
    label: 'Website',
    items: [
      { name: 'News & announcements', icon: Newspaper, path: '/admin/content' },
      { name: 'Photos', icon: Image, path: '/admin/photo-gallery' },
      { name: 'Board members', icon: Award, path: '/admin/board-members' },
      { name: 'Site settings', icon: Settings, path: '/admin/site-settings' }
    ]
  },
  {
    label: 'Money & inbox',
    items: [
      {
        name: 'Payments',
        icon: DollarSign,
        children: [
          { name: 'Payment management', path: '/admin/payment-management' },
          { name: 'Email templates', path: '/admin/payment-settings' }
        ]
      },
      { name: 'Messages', icon: Inbox, path: '/admin/contact-messages', count: 'messages' }
    ]
  },
  {
    label: 'System',
    items: [
      { name: 'Users', icon: UserCog, path: '/admin/users' },
      { name: 'Memberships', icon: Users, path: '/admin/memberships', count: 'memberships' },
      { name: 'Archives', icon: Archive, path: '/admin/archives' }
    ]
  }
];

// A path is active when it is the current page or a page beneath it ("/admin" only matches itself).
export const isPathActive = (pathname: string, path: string): boolean =>
  path === '/admin' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);

export const isItemActive = (item: NavItem, pathname: string): boolean =>
  item.path ? isPathActive(pathname, item.path) : (item.children ?? []).some((child) => isPathActive(pathname, child.path));

export interface JumpEntry {
  label: string;
  path: string;
  group: string;
}

// Every page in the menu as one flat list, for the Jump to box.
export const getJumpEntries = (): JumpEntry[] => {
  const entries: JumpEntry[] = [];
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      const groupName = group.label ?? 'Overview';
      if (item.path) {
        entries.push({ label: item.name, path: item.path, group: groupName });
      }
      for (const child of item.children ?? []) {
        entries.push({ label: `${item.name}: ${child.name}`, path: child.path, group: groupName });
      }
    }
  }
  entries.push({ label: 'View the public site', path: '/', group: 'Site' });
  return entries;
};

export const filterJumpEntries = (entries: JumpEntry[], query: string): JumpEntry[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;
  return entries.filter((entry) => {
    const text = `${entry.label} ${entry.group}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
};
