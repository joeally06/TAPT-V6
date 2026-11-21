// Everything the Archives page needs to know about each kind of archive: where it is stored, how to label it,
// which columns go into the CSV download, and what the search box looks at. Kept free of any database code so it
// can be checked on its own.

export type ArchiveKind =
  | 'conference'
  | 'tech-conference'
  | 'exhibitor'
  | 'hall-of-fame'
  | 'student-scholarship'
  | 'president-nomination'
  | 'regional-director-nomination'
  | 'regional-luncheon';

export type ArchiveRow = Record<string, unknown>;

// Archived rows that belong to a main row (attendees of a registration, booth participants of an exhibitor)
export interface ArchiveChildConfig {
  table: string;
  // Column on the child row that holds the id its main row had BEFORE it was archived
  foreignKey: string;
}

export interface ArchiveColumn {
  header: string;
  value: (row: ArchiveRow, children: ArchiveRow[]) => string | number;
}

export interface ArchiveTypeConfig {
  kind: ArchiveKind;
  tabLabel: string;
  title: string;
  table: string;
  settingsTable: string;
  // Header of the "how many" column in the list
  countLabel: string;
  columns: ArchiveColumn[];
  searchFields: (row: ArchiveRow) => unknown[];
  child?: ArchiveChildConfig;
}

// ---- small helpers ----

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

const joinName = (row: ArchiveRow, first: string, last: string): string => `${text(row[first])} ${text(row[last])}`.trim();

export const formatArchiveDate = (value: unknown): string => {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
};

// One quoted CSV cell; quotes inside the value are doubled so they cannot break the row
export const csvCell = (value: unknown): string => `"${text(value).replace(/"/g, '""')}"`;

const regionsOf = (row: ArchiveRow): string[] => {
  const selected = row.selected_regions;
  if (Array.isArray(selected) && selected.length > 0) return selected.map(text);
  return row.preferred_region ? [text(row.preferred_region)] : [];
};

const scholarshipName = (row: ArchiveRow): string => {
  const name = row.full_name;
  if (name && typeof name === 'object') {
    const parts = name as { first?: unknown; last?: unknown };
    return `${text(parts.first)} ${text(parts.last)}`.trim();
  }
  return text(name);
};

const attendeeNames = (children: ArchiveRow[]): string =>
  children.map((child) => `${joinName(child, 'first_name', 'last_name')} (${text(child.email)})`).join('; ');

const participantNames = (children: ArchiveRow[]): string =>
  children
    .map((child) => `${joinName(child, 'first_name', 'last_name')}${child.role ? ` (${text(child.role)})` : ''}`)
    .join('; ');

const archivedDate: ArchiveColumn = { header: 'Archived Date', value: (row) => formatArchiveDate(row.archived_at) };

const registrationColumns = (attendees: ArchiveColumn): ArchiveColumn[] => [
  { header: 'School District', value: (row) => text(row.school_district) },
  { header: 'Name', value: (row) => joinName(row, 'first_name', 'last_name') },
  { header: 'Email', value: (row) => text(row.email) },
  { header: 'Phone', value: (row) => text(row.phone) },
  { header: 'Total Attendees', value: (row) => text(row.total_attendees || 0) },
  { header: 'Total Amount', value: (row) => text(row.total_amount || 0) },
  archivedDate,
  attendees
];

const registrationSearch = (row: ArchiveRow): unknown[] => [
  row.school_district,
  row.first_name,
  row.last_name,
  row.email,
  row.billing_first_name,
  row.billing_last_name,
  row.billing_email,
  row.po_number
];

// ---- the eight archive types, in the order the tabs are shown ----

export const ARCHIVE_TYPES: ArchiveTypeConfig[] = [
  {
    kind: 'conference',
    tabLabel: 'Conference',
    title: 'Conference Registrations',
    table: 'conference_registrations_archive',
    settingsTable: 'conference_settings',
    countLabel: 'School Districts',
    columns: registrationColumns({ header: 'Additional Attendees', value: (_row, children) => attendeeNames(children) }),
    searchFields: registrationSearch,
    child: { table: 'conference_attendees_archive', foreignKey: 'registration_id' }
  },
  {
    kind: 'tech-conference',
    tabLabel: 'Tech Conference',
    title: 'Tech Conference Registrations',
    table: 'tech_conference_registrations_archive',
    settingsTable: 'tech_conference_settings',
    countLabel: 'School Districts',
    columns: registrationColumns({ header: 'Additional Attendees', value: (_row, children) => attendeeNames(children) }),
    searchFields: registrationSearch,
    child: { table: 'tech_conference_attendees_archive', foreignKey: 'registration_id' }
  },
  {
    kind: 'exhibitor',
    tabLabel: 'Exhibitor',
    title: 'Exhibitor Registrations',
    table: 'exhibitor_registrations_archive',
    settingsTable: 'exhibitor_settings',
    countLabel: 'Businesses',
    columns: [
      { header: 'Business Name', value: (row) => text(row.business_name) },
      { header: 'Contact Name', value: (row) => joinName(row, 'first_name', 'last_name') },
      { header: 'Email', value: (row) => text(row.email) },
      { header: 'Phone', value: (row) => text(row.phone) },
      { header: 'City', value: (row) => text(row.city) },
      { header: 'State', value: (row) => text(row.state) },
      archivedDate,
      { header: 'Additional Participants Count', value: (_row, children) => children.length },
      { header: 'Participant Names', value: (_row, children) => participantNames(children) }
    ],
    searchFields: (row) => [row.business_name, row.first_name, row.last_name, row.email, row.city],
    child: { table: 'exhibitor_participants_archive', foreignKey: 'exhibitor_registration_id' }
  },
  {
    kind: 'hall-of-fame',
    tabLabel: 'Hall of Fame',
    title: 'Hall of Fame Nominations',
    table: 'hall_of_fame_nominations_archive',
    settingsTable: 'hall_of_fame_settings',
    countLabel: 'Nominations',
    columns: [
      { header: 'Nominee', value: (row) => joinName(row, 'nominee_first_name', 'nominee_last_name') },
      { header: 'District', value: (row) => text(row.district) },
      { header: 'Region', value: (row) => text(row.region || row.grand_division) },
      { header: 'Years of Service', value: (row) => text(row.years_of_service) },
      { header: 'Status', value: (row) => text(row.status) },
      archivedDate
    ],
    searchFields: (row) => [
      row.nominee_first_name,
      row.nominee_last_name,
      row.district,
      row.supervisor_first_name,
      row.supervisor_last_name,
      row.supervisor_email,
      row.grand_division
    ]
  },
  {
    kind: 'student-scholarship',
    tabLabel: 'Student Scholarship',
    title: 'Student Scholarship Applications',
    table: 'student_scholarship_applications_archive',
    settingsTable: 'student_scholarship_settings',
    countLabel: 'Applications',
    columns: [
      { header: 'Name', value: (row) => scholarshipName(row) },
      { header: 'Email', value: (row) => text(row.email) },
      { header: 'High School', value: (row) => text(row.high_school) },
      { header: 'School District', value: (row) => text(row.school_district) },
      // `status` (pending / approved / rejected) is the real review status; `application_status` is the old field
      { header: 'Status', value: (row) => text(row.status || row.application_status) },
      archivedDate
    ],
    searchFields: (row) => [
      scholarshipName(row),
      row.email,
      row.high_school,
      row.school_district,
      row.nominator_first_name,
      row.nominator_last_name,
      row.nominator_email
    ]
  },
  {
    kind: 'president-nomination',
    tabLabel: 'President',
    title: 'President Nominations',
    table: 'president_nominations_archive',
    settingsTable: 'president_nomination_settings',
    countLabel: 'Nominations',
    columns: [
      { header: 'Nominee', value: (row) => joinName(row, 'nominee_first_name', 'nominee_last_name') },
      { header: 'District', value: (row) => text(row.nominee_school_district) },
      { header: 'Region', value: (row) => text(row.nominee_region) },
      { header: 'Email', value: (row) => text(row.nominee_email) },
      { header: 'Phone', value: (row) => text(row.nominee_phone) },
      { header: 'Nominator', value: (row) => joinName(row, 'nominator_first_name', 'nominator_last_name') },
      { header: 'Status', value: (row) => text(row.status) },
      archivedDate
    ],
    searchFields: (row) => [
      row.nominee_first_name,
      row.nominee_last_name,
      row.nominee_school_district,
      row.nominee_email,
      row.nominator_first_name,
      row.nominator_last_name,
      row.nominator_email
    ]
  },
  {
    kind: 'regional-director-nomination',
    tabLabel: 'Regional Director',
    title: 'Regional Director Nominations',
    table: 'regional_director_nominations_archive',
    settingsTable: 'regional_director_nomination_settings',
    countLabel: 'Nominations',
    columns: [
      { header: 'Candidate', value: (row) => joinName(row, 'candidate_first_name', 'candidate_last_name') },
      { header: 'District', value: (row) => text(row.candidate_school_district) },
      { header: 'Region', value: (row) => text(row.candidate_region) },
      { header: 'Email', value: (row) => text(row.candidate_email) },
      { header: 'Phone', value: (row) => text(row.candidate_phone) },
      { header: 'Nominator', value: (row) => joinName(row, 'nominator_first_name', 'nominator_last_name') },
      { header: 'Nominator Title', value: (row) => text(row.nominator_title) },
      { header: 'Status', value: (row) => text(row.status) },
      archivedDate
    ],
    searchFields: (row) => [
      row.candidate_first_name,
      row.candidate_last_name,
      row.candidate_school_district,
      row.candidate_email,
      row.nominator_first_name,
      row.nominator_last_name,
      row.nominator_email
    ]
  },
  {
    kind: 'regional-luncheon',
    tabLabel: 'Regional Luncheon',
    title: 'Regional Luncheon Registrations',
    table: 'regional_luncheon_registrations_archive',
    settingsTable: 'regional_luncheon_settings',
    countLabel: 'Registrations',
    columns: [
      { header: 'Name', value: (row) => text(row.name) },
      { header: 'Email', value: (row) => text(row.email) },
      { header: 'District/Organization', value: (row) => text(row.district_organization) },
      { header: 'Number of Attendees', value: (row) => text(row.number_of_attendees) },
      { header: 'Selected Regions', value: (row) => regionsOf(row).join('; ') },
      { header: 'Submitted', value: (row) => formatArchiveDate(row.created_at) },
      archivedDate
    ],
    searchFields: (row) => [row.name, row.email, row.district_organization, ...regionsOf(row)]
  }
];

export const getArchiveType = (kind: ArchiveKind): ArchiveTypeConfig => {
  const config = ARCHIVE_TYPES.find((type) => type.kind === kind);
  if (!config) throw new Error(`Unknown archive type: ${kind}`);
  return config;
};

// ---- grouping, CSV and search ----

export interface ArchiveBatch {
  archiveId: string;
  archivedAt: string;
  settingsId: string | null;
  rows: ArchiveRow[];
}

// One batch per rollover (they share an archive_id), newest first
export const groupBatches = (rows: ArchiveRow[]): ArchiveBatch[] => {
  const batches = new Map<string, ArchiveBatch>();
  for (const row of rows) {
    const archiveId = text(row.archive_id);
    let batch = batches.get(archiveId);
    if (!batch) {
      batch = {
        archiveId,
        archivedAt: text(row.archived_at),
        settingsId: row.archived_settings_id ? text(row.archived_settings_id) : null,
        rows: []
      };
      batches.set(archiveId, batch);
    }
    batch.rows.push(row);
  }
  return [...batches.values()].sort((a, b) => Date.parse(b.archivedAt) - Date.parse(a.archivedAt));
};

// The id a main row had before it was archived. Archived attendees and participants still point at this id.
export const originalIdOf = (row: ArchiveRow): string => text(row.original_id || row.id);

export const groupChildren = (children: ArchiveRow[], foreignKey: string): Map<string, ArchiveRow[]> => {
  const byParent = new Map<string, ArchiveRow[]>();
  for (const child of children) {
    const key = text(child[foreignKey]);
    const list = byParent.get(key);
    if (list) list.push(child);
    else byParent.set(key, [child]);
  }
  return byParent;
};

export const buildArchiveCsv = (
  config: ArchiveTypeConfig,
  rows: ArchiveRow[],
  childrenByParent: Map<string, ArchiveRow[]> = new Map()
): string => {
  const header = config.columns.map((column) => csvCell(column.header)).join(',');
  const lines = rows.map((row) => {
    const children = childrenByParent.get(originalIdOf(row)) ?? [];
    return config.columns.map((column) => csvCell(column.value(row, children))).join(',');
  });
  return [header, ...lines].join('\n');
};

// A batch matches when the search words appear in its cycle name, its date, or any of its rows' key fields
export const batchMatchesSearch = (
  config: ArchiveTypeConfig,
  batch: ArchiveBatch,
  term: string,
  cycleName: string | null | undefined
): boolean => {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  if (text(cycleName).toLowerCase().includes(needle)) return true;
  if (formatArchiveDate(batch.archivedAt).toLowerCase().includes(needle)) return true;
  return batch.rows.some((row) =>
    config
      .searchFields(row)
      .some((value) => text(value).toLowerCase().includes(needle))
  );
};
