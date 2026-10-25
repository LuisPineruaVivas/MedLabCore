/**
 * Helpers for building PostgREST filter strings (`.or()`, `.filter()`) from user text.
 * Inside those strings `,` `(` `)` and `"` are syntax, so raw input breaks the query
 * (e.g. searching "Pérez, Juan"). Values are double-quoted the way PostgREST expects.
 */

/** Wraps a user value for use inside .or()/.filter() strings. */
export function pgrstValue(raw: string): string {
  return `"${raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** `col1.ilike."%term%",col2.ilike."%term%"…` — `%` and `_` typed by the user match literally. */
export function ilikeAny(columns: string[], search: string): string {
  const pattern = `%${search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const value = pgrstValue(pattern);
  return columns.map((column) => `${column}.ilike.${value}`).join(",");
}
