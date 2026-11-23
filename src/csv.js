// Builds a CSV file from transfer rows (client-side export, nothing is sent anywhere).

function cell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formulas and quote every cell.
  const safe = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function toCsv(header, rows) {
  return [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(filename, text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
