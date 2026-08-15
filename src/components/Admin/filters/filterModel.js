import { safeUuid } from '../../../utils/uuid';

// The shape of a filter set, shared by the Contacts list and the Communications
// recipient picker.
//
//   group     { id, kind: 'group', conjunction: 'and' | 'or', children: [node] }
//   condition { id, kind: 'condition', field, operator, value }
//
// Groups nest arbitrarily, so "email is not empty AND (registered 2025 OR won an
// award)" is expressible. compileFilters.js walks this tree; nothing else should
// need to know its internals.
//
// Value shape depends on the operator's arity and the field's type:
//   arity 0             -> undefined
//   arity 1, multi      -> array of option values
//   arity 1, otherwise  -> string ('' while the admin is still typing)
//   arity 2             -> [string, string]

export const FILTER_TREE_VERSION = 1;

export const makeCondition = (field, operator, value) => ({
  id: safeUuid(),
  kind: 'condition',
  field,
  operator,
  value,
});

export const makeGroup = (conjunction = 'and', children = []) => ({
  id: safeUuid(),
  kind: 'group',
  conjunction,
  children,
});

export const emptyTree = () => makeGroup('and', []);

// Operators available for each field type. `arity` is how many value inputs the
// row renders. Order matters — the first entry is the default when a field is
// picked, so it should be the one an admin most often wants.
export const OPERATORS = {
  text: [
    { value: 'contains', label: 'contains', arity: 1 },
    { value: 'not_contains', label: 'does not contain', arity: 1 },
    { value: 'equals', label: 'is', arity: 1 },
    { value: 'not_equals', label: 'is not', arity: 1 },
    { value: 'starts_with', label: 'starts with', arity: 1 },
    { value: 'ends_with', label: 'ends with', arity: 1 },
    { value: 'is_empty', label: 'is empty', arity: 0 },
    { value: 'is_not_empty', label: 'is not empty', arity: 0 },
  ],
  number: [
    { value: 'equals', label: 'equals', arity: 1 },
    { value: 'not_equals', label: 'does not equal', arity: 1 },
    { value: 'gt', label: 'is greater than', arity: 1 },
    { value: 'gte', label: 'is greater than or equal to', arity: 1 },
    { value: 'lt', label: 'is less than', arity: 1 },
    { value: 'lte', label: 'is less than or equal to', arity: 1 },
    { value: 'between', label: 'is between', arity: 2 },
  ],
  date: [
    { value: 'on', label: 'is on', arity: 1 },
    { value: 'before', label: 'is before', arity: 1 },
    { value: 'after', label: 'is after', arity: 1 },
    { value: 'on_or_before', label: 'is on or before', arity: 1 },
    { value: 'on_or_after', label: 'is on or after', arity: 1 },
    { value: 'between', label: 'is between', arity: 2 },
    { value: 'in_last_days', label: 'is within the last (days)', arity: 1 },
    { value: 'more_than_days_ago', label: 'is more than (days) ago', arity: 1 },
    { value: 'is_empty', label: 'is empty', arity: 0 },
    { value: 'is_not_empty', label: 'is not empty', arity: 0 },
  ],
  boolean: [
    { value: 'is_true', label: 'is yes', arity: 0 },
    { value: 'is_false', label: 'is no', arity: 0 },
  ],
  // Columns holding an array of values (tournament years, event ids, award
  // categories, …). This is the type that answers "registered for X" and, just
  // as importantly, "NOT registered for X".
  multi: [
    { value: 'includes_any', label: 'is any of', arity: 1 },
    { value: 'includes_all', label: 'is all of', arity: 1 },
    { value: 'excludes_any', label: 'is none of', arity: 1 },
    { value: 'is_not_empty', label: 'has any', arity: 0 },
    { value: 'is_empty', label: 'has none', arity: 0 },
  ],
};

// Fields can rename operators without changing their semantics, so
// `tournament_years is none of 2025` can read "is NOT registered for".
export const operatorsForField = (field) => {
  const ops = OPERATORS[field?.type] || [];
  if (!field?.opLabels) return ops;
  return ops.map((o) => (field.opLabels[o.value] ? { ...o, label: field.opLabels[o.value] } : o));
};

export const findOperator = (field, operatorValue) =>
  operatorsForField(field).find((o) => o.value === operatorValue) || null;

export const defaultOperatorFor = (field) => operatorsForField(field)[0]?.value ?? null;

// The empty value matching a given (field, operator) pair. Used when a row is
// created and whenever the field or operator changes underneath an existing one.
export const defaultValueFor = (field, operatorValue) => {
  const op = findOperator(field, operatorValue);
  if (!op || op.arity === 0) return undefined;
  if (op.arity === 2) return ['', ''];
  return field?.type === 'multi' ? [] : '';
};

// ---------------------------------------------------------------------------
// Tree edits — all pure, all returning a new tree.
// ---------------------------------------------------------------------------

// Replace whichever node has `id` with `updater(node)`. Returning null from the
// updater removes the node.
const mapNode = (node, id, updater) => {
  if (node.id === id) return updater(node);
  if (node.kind !== 'group') return node;
  return { ...node, children: node.children.map((c) => mapNode(c, id, updater)).filter(Boolean) };
};

export const updateNode = (tree, id, updater) => mapNode(tree, id, updater);

export const removeNode = (tree, id) => mapNode(tree, id, () => null) || emptyTree();

export const appendChild = (tree, groupId, child) =>
  mapNode(tree, groupId, (g) =>
    g.kind === 'group' ? { ...g, children: [...g.children, child] } : g
  );

export const setConjunction = (tree, groupId, conjunction) =>
  mapNode(tree, groupId, (g) => (g.kind === 'group' ? { ...g, conjunction } : g));

// Total conditions in the tree, regardless of whether they're complete enough to
// affect the query. For the "N active" badge use countCompiledConditions in
// compileFilters.js instead, which ignores half-filled rows.
export const countConditions = (node) => {
  if (!node) return 0;
  if (node.kind === 'condition') return 1;
  return (node.children || []).reduce((n, c) => n + countConditions(c), 0);
};

// ---------------------------------------------------------------------------
// Persistence — what gets written to contact_filter_views.filter_tree.
// ---------------------------------------------------------------------------

// Ids are local React keys, not data — strip them so the stored JSON is
// portable and two identical filter sets compare equal.
const stripIds = (node) => {
  if (!node) return null;
  if (node.kind === 'group') {
    return { kind: 'group', conjunction: node.conjunction, children: (node.children || []).map(stripIds) };
  }
  return { kind: 'condition', field: node.field, operator: node.operator, value: node.value };
};

export const serializeTree = (tree) => ({ version: FILTER_TREE_VERSION, root: stripIds(tree) });

// Rehydrate a stored tree, regenerating ids (they're local UI handles, not data)
// and dropping anything that doesn't match the current shape. A saved view that
// references a field the registry no longer has is silently pruned rather than
// crashing the page.
export const deserializeTree = (stored, isKnownField) => {
  const revive = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.kind === 'group') {
      const children = (node.children || []).map(revive).filter(Boolean);
      return { id: safeUuid(), kind: 'group', conjunction: node.conjunction === 'or' ? 'or' : 'and', children };
    }
    if (node.kind !== 'condition') return null;
    if (isKnownField && !isKnownField(node.field)) return null;
    return { id: safeUuid(), kind: 'condition', field: node.field, operator: node.operator, value: node.value };
  };
  const root = revive(stored?.root);
  return root && root.kind === 'group' ? root : emptyTree();
};
