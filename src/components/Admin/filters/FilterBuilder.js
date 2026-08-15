import React, { useMemo } from 'react';
import FilterGroup from './FilterGroup';
import { buildFieldMap } from './contactFilterFields';
import { emptyTree } from './filterModel';
import { countCompiledConditions } from './compileFilters';

// A nestable AND/OR condition tree. Saved views live in SavedViewsBar, which the
// page renders above this rather than inside it.
//
//   tree     the current filter tree (see filterModel.js)
//   fields   field registry for this scope (getContactFilterFields)
//   options  dynamic option lists (useContactFilterOptions)
export default function FilterBuilder({
  tree,
  onChange,
  fields,
  options,
  optionsLoading = false,
}) {
  const fieldMap = useMemo(() => buildFieldMap(fields), [fields]);
  const activeCount = useMemo(
    () => countCompiledConditions(tree, fieldMap),
    [tree, fieldMap]
  );

  return (
    <div className="space-y-4">
      {optionsLoading && (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading filter options…</p>
      )}

      <FilterGroup
        group={tree}
        fields={fields}
        fieldMap={fieldMap}
        options={options}
        depth={0}
        onChange={onChange}
      />

      {activeCount > 0 && (
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-night-700 pt-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {activeCount} active {activeCount === 1 ? 'condition' : 'conditions'}
          </span>
          <button
            type="button"
            onClick={() => onChange(emptyTree())}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
