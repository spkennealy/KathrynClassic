import React from 'react';
import Select from '../Select';
import FilterValueInput from './FilterValueInput';
import { operatorsForField, findOperator, defaultOperatorFor, defaultValueFor } from './filterModel';
import { fieldGroups } from './contactFilterFields';

// One `[field] [operator] [value]` row. Stacks vertically on narrow screens.
export default function FilterCondition({ condition, fields, fieldMap, options, onChange, onRemove }) {
  const field = fieldMap[condition.field] || null;
  const operators = field ? operatorsForField(field) : [];
  const operator = field ? findOperator(field, condition.operator) : null;

  // Changing the field invalidates both the operator and the value — a date
  // operator means nothing on a text column.
  const handleFieldChange = (key) => {
    const next = fieldMap[key];
    if (!next) return;
    const op = defaultOperatorFor(next);
    onChange({ ...condition, field: key, operator: op, value: defaultValueFor(next, op) });
  };

  // Changing the operator keeps the value only when the input shape is the same,
  // so switching "is" → "contains" doesn't clear what was typed.
  const handleOperatorChange = (opValue) => {
    const nextOp = findOperator(field, opValue);
    const sameShape = operator && nextOp && operator.arity === nextOp.arity;
    onChange({
      ...condition,
      operator: opValue,
      value: sameShape ? condition.value : defaultValueFor(field, opValue),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-start">
      <Select searchable value={condition.field} onChange={(e) => handleFieldChange(e.target.value)}>
        {fieldGroups(fields).map((groupName) => [
          // Select renders flat <option> children, so group headings are
          // disabled rows rather than real <optgroup>s.
          <option key={`heading-${groupName}`} value={`__heading_${groupName}`} disabled>
            — {groupName} —
          </option>,
          ...fields
            .filter((f) => f.group === groupName)
            .map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            )),
        ])}
      </Select>

      <Select searchable value={condition.operator} onChange={(e) => handleOperatorChange(e.target.value)}>
        {operators.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      {/* Keeps the row's column grid intact when the operator takes no value. */}
      <div className={operator && operator.arity === 0 ? 'hidden md:block' : ''}>
        <FilterValueInput
          field={field}
          operator={operator}
          value={condition.value}
          options={options}
          onChange={(value) => onChange({ ...condition, value })}
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove condition"
        title="Remove condition"
        className="justify-self-end rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-night-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
