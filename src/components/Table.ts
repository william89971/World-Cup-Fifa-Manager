import { escapeHtml } from './colors';

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableRow {
  id?: string;
  /** Per-row tone class (is-user, is-warn, is-danger, is-success). */
  tone?: 'user' | 'warn' | 'danger' | 'success';
  cells: Record<string, string>;
  dataAction?: string;
  dataAttrs?: Record<string, string>;
}

export interface TableProps {
  columns: TableColumn[];
  rows: TableRow[];
  emptyLabel?: string;
}

export function table(props: TableProps): string {
  if (props.rows.length === 0) {
    return `<p class="mgr-muted">${escapeHtml(props.emptyLabel ?? 'No data')}</p>`;
  }
  return `<table class="mgr-table">
    <thead><tr>${props.columns
      .map((col) => `<th style="text-align:${col.align ?? 'left'}">${escapeHtml(col.label)}</th>`)
      .join('')}</tr></thead>
    <tbody>
      ${props.rows
        .map((row) => {
          const toneClass = row.tone ? `is-${row.tone}` : '';
          const action = row.dataAction ? ` data-action="${escapeHtml(row.dataAction)}"` : '';
          const attrs = row.dataAttrs
            ? Object.entries(row.dataAttrs)
                .map(([k, v]) => ` data-${k}="${escapeHtml(v)}"`)
                .join('')
            : '';
          return `<tr class="${toneClass}"${action}${attrs}>${props.columns
            .map(
              (col) =>
                `<td style="text-align:${col.align ?? 'left'}">${row.cells[col.key] ?? ''}</td>`,
            )
            .join('')}</tr>`;
        })
        .join('')}
    </tbody>
  </table>`;
}
