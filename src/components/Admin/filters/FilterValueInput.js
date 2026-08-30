import React from 'react';
import MultiSelect from '../MultiSelect';
import DatePicker from '../DatePicker';

const inputCls =
  'block w-full rounded-lg border border-gray-400 dark:border-night-600 py-2.5 px-3 text-sm shadow-sm ' +
  'bg-white dark:bg-night-700 text-gray-900 dark:text-gray-100 dark:placeholder-gray-400 ' +
  'focus:border-primary-500 focus:outline-none focus:ring-0';

// The value control for one condition row. Which control appears is a function
// of the field's type and the operator's arity — operators like "is empty" take
// no value at all and render nothing.
export default function FilterValueInput({ field, operator, value, onChange, options = {} }) {
  if (!field || !operator || operator.arity === 0) return null;

  if (field.type === 'multi') {
    const list = field.options || options[field.optionsKey] || [];
    return (
      <MultiSelect
        searchable
        options={list}
        selected={Array.isArray(value) ? value : []}
        onChange={onChange}
        allLabel={list.length ? 'Select values…' : 'No options'}
      />
    );
  }

  if (field.type === 'date') {
    // These two take a number of days, not a calendar date.
    if (operator.value === 'in_last_days' || operator.value === 'more_than_days_ago') {
      return (
        <input
          type="number"
          min="0"
          className={inputCls}
          placeholder="days"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    if (operator.arity === 2) {
      const [from, to] = Array.isArray(value) ? value : ['', ''];
      return (
        <div className="flex items-center gap-2">
          <DatePicker value={from} onChange={(e) => onChange([e.target.value, to])} />
          <span className="text-xs text-gray-500 dark:text-gray-400">and</span>
          <DatePicker value={to} onChange={(e) => onChange([from, e.target.value])} />
        </div>
      );
    }
    return <DatePicker value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }

  if (field.type === 'number') {
    if (operator.arity === 2) {
      const [from, to] = Array.isArray(value) ? value : ['', ''];
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            className={inputCls}
            value={from}
            onChange={(e) => onChange([e.target.value, to])}
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">and</span>
          <input
            type="number"
            className={inputCls}
            value={to}
            onChange={(e) => onChange([from, e.target.value])}
          />
        </div>
      );
    }
    return (
      <input
        type="number"
        className={inputCls}
        placeholder="Value"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type="text"
      spellCheck={false}
      className={inputCls}
      placeholder="Value"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
