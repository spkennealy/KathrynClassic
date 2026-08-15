import { FIELD_MAP, CONTACT_FILTER_FIELDS } from './contactFilterFields';
import { OPERATORS } from './filterModel';

// Turns a nested AND/OR filter tree into a single PostgREST logic-tree string.
//
// The whole filter set is applied with one `query.or(fragment)` call, because
// supabase-js exposes `.or()` but no `.and()`. PostgREST's logic-tree grammar
// nests arbitrarily, so a root AND group is emitted as `and(...)` inside that
// wrapper: `?or=(and(a,or(b,c)))`.
//
// Three escaping hazards are handled here, and nothing outside this module
// should ever build a PostgREST filter string by hand:
//
//   1. `,` `(` `)` are the grammar's delimiters, so every scalar value is
//      double-quoted with `"` and `\` backslash-escaped.
//   2. `%` and `_` are LIKE wildcards, and PostgREST additionally maps `*` to
//      `%`, so patterns get those escaped too.
//   3. Array literals (`{...}`) cannot be quoted, and an unquoted `,` inside one
//      would terminate the value. Multi-value conditions are therefore expanded
//      into one single-element `cs.{v}` per value, combined with and()/or().

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

export const quote = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// The backslash added here is doubled by quote() and un-doubled by PostgREST, so
// Postgres receives a single `\`, its default LIKE escape character.
export const likeEscape = (s) => String(s).replace(/([\\%_])/g, '\\$1');

// Array-literal elements are the one place a value cannot be quoted, so they
// must contain nothing the grammar reacts to. A whitelist rather than a
// blacklist: every registered array field holds ints, uuids, enum values or
// sanitized keys, so this should never actually reject anything — it exists so
// that a future field with looser values fails closed instead of corrupting the
// query.
const ARRAY_TOKEN_RE = /^[A-Za-z0-9_.:@+-]+$/;
const isArraySafe = (v) => ARRAY_TOKEN_RE.test(String(v));

const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// The admin picks a calendar day; the column stores a timestamptz. Convert the
// local day's bounds to ISO so "created on Aug 15" means their Aug 15, not UTC's.
const localDayStart = (ymd) => {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
};
const localDayEnd = (ymd) => {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
};
const daysAgoIso = (n) => new Date(Date.now() - n * 86400000).toISOString();

// ---------------------------------------------------------------------------
// Per-type compilers
//
// Negative operators are all NULL-safe. Plain `neq`/`not.ilike` exclude NULLs,
// but an admin asking for "email does not contain @gmail" means to include
// contacts with no email at all.
// ---------------------------------------------------------------------------

function compileText(col, op, raw) {
  // A blank string is not the same as NULL, and both exist in this data.
  if (op === 'is_empty') return `or(${col}.is.null,${col}.eq."")`;
  if (op === 'is_not_empty') return `and(${col}.not.is.null,${col}.neq."")`;

  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return null; // half-typed row — ignored rather than treated as empty
  const esc = likeEscape(v);

  switch (op) {
    case 'equals':
      return `${col}.ilike.${quote(esc)}`;
    case 'not_equals':
      return `or(${col}.is.null,${col}.not.ilike.${quote(esc)})`;
    case 'contains':
      return `${col}.ilike.${quote(`%${esc}%`)}`;
    case 'not_contains':
      return `or(${col}.is.null,${col}.not.ilike.${quote(`%${esc}%`)})`;
    case 'starts_with':
      return `${col}.ilike.${quote(`${esc}%`)}`;
    case 'ends_with':
      return `${col}.ilike.${quote(`%${esc}`)}`;
    default:
      return null;
  }
}

function compileNumber(col, op, raw) {
  if (op === 'is_empty') return `${col}.is.null`;
  if (op === 'is_not_empty') return `${col}.not.is.null`;

  if (op === 'between') {
    const a = num(Array.isArray(raw) ? raw[0] : null);
    const b = num(Array.isArray(raw) ? raw[1] : null);
    if (a === null || b === null) return null;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return `and(${col}.gte.${lo},${col}.lte.${hi})`;
  }

  const n = num(raw);
  if (n === null) return null;
  switch (op) {
    case 'equals':
      return `${col}.eq.${n}`;
    case 'not_equals':
      return `or(${col}.is.null,${col}.neq.${n})`;
    case 'gt':
      return `${col}.gt.${n}`;
    case 'gte':
      return `${col}.gte.${n}`;
    case 'lt':
      return `${col}.lt.${n}`;
    case 'lte':
      return `${col}.lte.${n}`;
    default:
      return null;
  }
}

function compileDate(col, op, raw) {
  if (op === 'is_empty') return `${col}.is.null`;
  if (op === 'is_not_empty') return `${col}.not.is.null`;

  if (op === 'in_last_days' || op === 'more_than_days_ago') {
    const n = num(raw);
    if (n === null || n < 0) return null;
    const cutoff = quote(daysAgoIso(n));
    return op === 'in_last_days' ? `${col}.gte.${cutoff}` : `${col}.lt.${cutoff}`;
  }

  if (op === 'between') {
    const s = localDayStart(Array.isArray(raw) ? raw[0] : null);
    const e = localDayEnd(Array.isArray(raw) ? raw[1] : null);
    if (!s || !e) return null;
    return `and(${col}.gte.${quote(s)},${col}.lte.${quote(e)})`;
  }

  const s = localDayStart(raw);
  const e = localDayEnd(raw);
  if (!s || !e) return null;
  switch (op) {
    case 'on':
      return `and(${col}.gte.${quote(s)},${col}.lte.${quote(e)})`;
    case 'before':
      return `${col}.lt.${quote(s)}`;
    case 'on_or_before':
      return `${col}.lte.${quote(e)}`;
    case 'after':
      return `${col}.gt.${quote(e)}`;
    case 'on_or_after':
      return `${col}.gte.${quote(s)}`;
    default:
      return null;
  }
}

function compileBoolean(col, op) {
  if (op === 'is_true') return `${col}.is.true`;
  // NULL reads as "no" everywhere these flags are displayed.
  if (op === 'is_false') return `or(${col}.is.false,${col}.is.null)`;
  return null;
}

function compileMulti(field, op, raw) {
  const col = field.column;

  if (op === 'is_empty' || op === 'is_not_empty') {
    // The scalar companion count is index-friendly and avoids depending on
    // array-literal equality against `{}`.
    if (field.countColumn) {
      return op === 'is_empty' ? `${field.countColumn}.eq.0` : `${field.countColumn}.gt.0`;
    }
    return op === 'is_empty' ? `${col}.eq.{}` : `${col}.neq.{}`;
  }

  const values = (Array.isArray(raw) ? raw : [raw])
    .filter((v) => v !== '' && v !== null && v !== undefined)
    .map(String)
    .filter(isArraySafe);
  if (values.length === 0) return null;

  // One single-element literal per value — `{2024,2025}` cannot appear inside a
  // logic tree, and the literal itself cannot be quoted to protect the comma.
  const has = (v) => `${col}.cs.{${v}}`;
  const lacks = (v) => `${col}.not.cs.{${v}}`;

  switch (op) {
    case 'includes_any':
      return values.length === 1 ? has(values[0]) : `or(${values.map(has).join(',')})`;
    case 'includes_all':
      return values.length === 1 ? has(values[0]) : `and(${values.map(has).join(',')})`;
    case 'excludes_any':
      // "none of" — must lack every listed value.
      return values.length === 1 ? lacks(values[0]) : `and(${values.map(lacks).join(',')})`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Tree walk
// ---------------------------------------------------------------------------

// Returns a PostgREST fragment, or null if the condition is incomplete or
// references a field/operator that no longer exists.
export function compileCondition(cond, fieldMap = FIELD_MAP) {
  const field = fieldMap[cond?.field];
  if (!field) return null;

  const known = (OPERATORS[field.type] || []).some((o) => o.value === cond.operator);
  if (!known) return null;

  switch (field.type) {
    case 'text':
      return compileText(field.column, cond.operator, cond.value);
    case 'number':
      return compileNumber(field.column, cond.operator, cond.value);
    case 'date':
      return compileDate(field.column, cond.operator, cond.value);
    case 'boolean':
      return compileBoolean(field.column, cond.operator);
    case 'multi':
      return compileMulti(field, cond.operator, cond.value);
    default:
      return null;
  }
}

// Recursive. Incomplete children are dropped; a group that ends up with no
// usable children compiles to null so it doesn't constrain the query. A group
// with exactly one child collapses to that child — `and(x)` is valid but the
// extra nesting makes the request URL harder to read while debugging.
export function compileNode(node, fieldMap = FIELD_MAP) {
  if (!node) return null;
  if (node.kind === 'condition') return compileCondition(node, fieldMap);
  if (node.kind !== 'group') return null;

  const parts = (node.children || []).map((c) => compileNode(c, fieldMap)).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${node.conjunction === 'or' ? 'or' : 'and'}(${parts.join(',')})`;
}

// The search box. Replaces the raw interpolation this page used to do, which
// broke — and let a user inject extra conditions — on any term containing a
// comma, paren or quote.
export function buildSearchFragment(term) {
  const t = (term || '').trim();
  if (!t) return null;
  const like = quote(`%${likeEscape(t)}%`);
  const parts = [`full_name.ilike.${like}`, `email.ilike.${like}`, `phone.ilike.${like}`];

  // "First Last" also matches across the two name columns, so a search for
  // "jon allen" finds Jonathan Allen even though neither column contains the
  // whole string. Mirrors buildSearchConditions() in RegistrationList.js.
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = quote(`%${likeEscape(words[0])}%`);
    const rest = quote(`%${likeEscape(words.slice(1).join(' '))}%`);
    parts.push(`and(first_name.ilike.${first},last_name.ilike.${rest})`);
  }

  return `or(${parts.join(',')})`;
}

// Search is always ANDed with the filter tree, whatever the tree's own root
// conjunction is — narrowing by name should never widen the result set.
export function buildFilterFragment({ searchTerm, tree, fieldMap = FIELD_MAP } = {}) {
  const parts = [buildSearchFragment(searchTerm), compileNode(tree, fieldMap)].filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `and(${parts.join(',')})`;
}

// The single place filter state becomes a query.
export function applyFilters(query, opts) {
  const fragment = buildFilterFragment(opts);
  return fragment ? query.or(fragment) : query;
}

// Conditions that actually constrain the query — drives the "N active" badge, so
// a row the admin is still filling in doesn't count.
export function countCompiledConditions(node, fieldMap = FIELD_MAP) {
  if (!node) return 0;
  if (node.kind === 'condition') return compileCondition(node, fieldMap) ? 1 : 0;
  return (node.children || []).reduce((n, c) => n + countCompiledConditions(c, fieldMap), 0);
}

// Exported for tests and for callers that need the default registry.
export const ALL_FIELDS = CONTACT_FILTER_FIELDS;
