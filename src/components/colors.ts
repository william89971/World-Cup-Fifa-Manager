export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function ratingBarClass(value0to100: number): 'mgr-bar--low' | 'mgr-bar--mid' | 'mgr-bar--high' {
  if (value0to100 >= 70) return 'mgr-bar--high';
  if (value0to100 >= 45) return 'mgr-bar--mid';
  return 'mgr-bar--low';
}

export function traitBarClass(value01: number): 'mgr-bar--low' | 'mgr-bar--mid' | 'mgr-bar--high' {
  if (value01 >= 0.7) return 'mgr-bar--high';
  if (value01 >= 0.5) return 'mgr-bar--mid';
  return 'mgr-bar--low';
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
