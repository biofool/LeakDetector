// backend/src/util/ref.ts — public reference format, e.g. WL-000123 [D-14].
export const toRef = (id: number | string): string =>
  `WL-${String(id).padStart(6, '0')}`;
