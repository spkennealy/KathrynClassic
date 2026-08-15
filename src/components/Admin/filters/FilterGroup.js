import React from 'react';
import Select from '../Select';
import FilterCondition from './FilterCondition';
import { makeCondition, makeGroup, defaultOperatorFor, defaultValueFor } from './filterModel';
import { DEFAULT_FIELD_KEY } from './contactFilterFields';

// Nesting past this gets hard to read and hard to reason about, and no realistic
// audience needs it.
export const MAX_DEPTH = 3;

// One AND/OR group and its children. Renders itself for nested groups, which is
// what makes "email is not empty AND (registered 2025 OR won an award)"
// expressible.
export default function FilterGroup({ group, fields, fieldMap, options, depth = 0, onChange, onRemove }) {
  const isRoot = depth === 0;

  const replaceChild = (id, next) =>
    onChange({
      ...group,
      children: group.children.map((c) => (c.id === id ? next : c)),
    });

  const removeChild = (id) =>
    onChange({ ...group, children: group.children.filter((c) => c.id !== id) });

  const addCondition = () => {
    const field = fieldMap[DEFAULT_FIELD_KEY] || fields[0];
    if (!field) return;
    const operator = defaultOperatorFor(field);
    onChange({
      ...group,
      children: [
        ...group.children,
        makeCondition(field.key, operator, defaultValueFor(field, operator)),
      ],
    });
  };

  // A nested group defaults to the opposite conjunction — nesting an AND inside
  // an AND is a no-op, so the other one is almost always what's wanted.
  const addGroup = () =>
    onChange({
      ...group,
      children: [...group.children, makeGroup(group.conjunction === 'and' ? 'or' : 'and')],
    });

  return (
    <div
      className={
        isRoot
          ? ''
          : 'rounded-lg border border-gray-200 dark:border-night-600 bg-gray-50/60 dark:bg-night-700/40 p-3'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <span>Match</span>
          <Select
            value={group.conjunction}
            onChange={(e) => onChange({ ...group, conjunction: e.target.value })}
            className="w-28"
          >
            <option value="and">all</option>
            <option value="or">any</option>
          </Select>
          <span>of:</span>
        </div>
        {!isRoot && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-gray-500 hover:text-red-600 dark:text-gray-400"
          >
            Remove group
          </button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {group.children.map((child, i) => (
          <div key={child.id}>
            {/* Spelling the connector out on each row after the first makes the
                group's conjunction readable without tracing back to the header. */}
            {i > 0 && (
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {group.conjunction === 'or' ? 'or' : 'and'}
              </div>
            )}
            {child.kind === 'group' ? (
              <FilterGroup
                group={child}
                fields={fields}
                fieldMap={fieldMap}
                options={options}
                depth={depth + 1}
                onChange={(next) => replaceChild(child.id, next)}
                onRemove={() => removeChild(child.id)}
              />
            ) : (
              <FilterCondition
                condition={child}
                fields={fields}
                fieldMap={fieldMap}
                options={options}
                onChange={(next) => replaceChild(child.id, next)}
                onRemove={() => removeChild(child.id)}
              />
            )}
          </div>
        ))}

        {group.children.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No conditions yet — every contact matches.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={addCondition}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          + Add filter
        </button>
        {depth < MAX_DEPTH - 1 && (
          <button
            type="button"
            onClick={addGroup}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            + Add group
          </button>
        )}
      </div>
    </div>
  );
}
