// Audit logging helpers.
//
// We keep an append-only record of admin mutations (who changed what, and when)
// in the `audit_log` table. logAudit() is called from event handlers after a
// successful Supabase mutation. It is best-effort: auditing is observability,
// not a hard dependency, so it NEVER throws — a logging failure must not break
// the action the admin just performed.

import { supabase } from '../supabaseClient';

// Known entity types — used to populate the Audit Log page's filter dropdown.
export const ENTITY_TYPES = [
  'contact',
  'registration',
  'tournament',
  'tournament_event',
  'expense',
  'team',
  'award',
  'golf_team',
  'golf_round_score',
  'tee_time',
  'email_template',
  'email_campaign',
  'tournament_rules',
];

/**
 * Append an entry to audit_log. Resolves the current admin itself (via the
 * cached auth session) so call sites don't have to thread `user` through.
 *
 * @param {Object}  p
 * @param {string}  p.action       e.g. 'contact.updated'
 * @param {string}  p.entityType   e.g. 'contact'
 * @param {string} [p.entityId]    pk of the affected row
 * @param {string} [p.entityLabel] human label, e.g. 'Jane Doe'
 * @param {Object} [p.changes]     diff ({ field: { from, to } }) or a snapshot
 * @param {Object} [p.metadata]    extra context
 */
export async function logAudit({ action, entityType, entityId, entityLabel, changes, metadata }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('audit_log').insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      entity_label: entityLabel ?? null,
      changes: changes ?? null,
      metadata: metadata ?? null,
    });
    if (error) console.error('logAudit insert failed:', error);
  } catch (err) {
    // Swallow everything — auditing must never block the admin's action.
    console.error('logAudit failed:', err);
  }
}

/**
 * Compute a shallow diff over a whitelist of fields. Returns only the changed
 * fields as { field: { from, to } }, or null if nothing changed. Normalizes
 * '' / undefined to null so format-only or no-op edits don't register.
 *
 * @param {Object} oldObj
 * @param {Object} newObj
 * @param {string[]} fields
 * @returns {Object|null}
 */
export function diffFields(oldObj = {}, newObj = {}, fields) {
  const norm = (v) => (v === undefined || v === '' ? null : v);
  const out = {};
  for (const f of fields) {
    const from = norm(oldObj?.[f]);
    const to = norm(newObj?.[f]);
    // JSON compare handles primitives and small arrays/objects safely.
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      out[f] = { from, to };
    }
  }
  return Object.keys(out).length ? out : null;
}

// Render a value for display in a diff/snapshot. Keeps it compact and readable.
function displayValue(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Turn a `changes` JSONB blob into a flat list of human-readable lines for the
 * Audit Log page and RecordHistory modal. Handles both update diffs
 * ({ field: { from, to } }) and create/delete snapshots ({ field: value }).
 *
 * @param {Object|null} changes
 * @returns {{ field: string, from?: string, to?: string, value?: string, isDiff: boolean }[]}
 */
export function formatChanges(changes) {
  if (!changes || typeof changes !== 'object') return [];
  return Object.entries(changes).map(([field, val]) => {
    if (val && typeof val === 'object' && ('from' in val || 'to' in val)) {
      return { field, from: displayValue(val.from), to: displayValue(val.to), isDiff: true };
    }
    return { field, value: displayValue(val), isDiff: false };
  });
}
