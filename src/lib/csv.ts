// CSV export helpers shared by the admin registration pages.

// A cell that starts with one of these is read as a formula by Excel and Google Sheets. Registrants type these
// values, so a leading apostrophe makes the cell plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '""';
  let text = typeof value === 'string' ? value : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const toCsv = (headers: string[], rows: unknown[][]): string =>
  [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

// Saves the text as a file. The byte order mark lets Excel read accented names correctly.
export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const dateStamp = (now: Date = new Date()): string => now.toISOString().split('T')[0];
