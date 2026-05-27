import { stringify } from 'csv-stringify/sync';
import { parse } from 'csv-parse/sync';

export const CSV_COLUMNS = ['id', 'title', 'description', 'status', 'priority', 'type', 'assigneeId'];

export function ticketsToCsv(tickets: any[]): string {
  const rows = tickets.map(t => ({
    id: t.id,
    title: t.title,
    description: t.description ?? '',
    status: t.status,
    priority: t.priority,
    type: t.type,
    assigneeId: t.assigneeId ?? '',
  }));
  return stringify(rows, { header: true, columns: CSV_COLUMNS });
}

export function csvToRows(csv: string): Record<string, string>[] {
  return parse(csv, { columns: true, skip_empty_lines: true, trim: true });
}
