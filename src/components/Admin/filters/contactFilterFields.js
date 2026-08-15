// Every property a contact can be filtered on, and how each maps onto the
// admin_contact_activity view.
//
//   key          stable identifier, stored in saved views
//   group        optgroup heading in the field dropdown
//   column       column on admin_contact_activity
//   type         drives the operator list, the value control, and the compiler
//   options      static option list (multi fields)
//   optionsKey   dynamic option list, resolved by useContactFilterOptions
//   countColumn  scalar companion used for a multi field's "has any"/"has none"
//   opLabels     per-field operator relabelling, for readability
//
// A note on which columns are filterable: values for `multi` fields end up
// inside a PostgREST array literal, which cannot be quoted, so they must not
// contain `,` `(` or `)`. That's why event_names (admin free text) is display
// only, and awards filter on the sanitized award_category_keys rather than the
// raw award_categories.

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'voided', label: 'Voided' },
];

export const EVENT_TYPE_OPTIONS = [
  { value: 'golf_tournament', label: 'Golf Tournament' },
  { value: 'welcome_dinner', label: 'Welcome Dinner' },
  { value: 'beach_day', label: 'Beach Day' },
  { value: 'awards_dinner', label: 'Awards Dinner' },
  { value: 'other', label: 'Other' },
];

const REGISTERED_LABELS = {
  includes_any: 'is registered for any of',
  includes_all: 'is registered for all of',
  excludes_any: 'is NOT registered for',
  is_not_empty: 'has any',
  is_empty: 'has none',
};

export const CONTACT_FILTER_FIELDS = [
  // --- Contact -------------------------------------------------------------
  { key: 'full_name', group: 'Contact', label: 'Full name', type: 'text', column: 'full_name' },
  { key: 'first_name', group: 'Contact', label: 'First name', type: 'text', column: 'first_name' },
  { key: 'last_name', group: 'Contact', label: 'Last name', type: 'text', column: 'last_name' },
  { key: 'email', group: 'Contact', label: 'Email', type: 'text', column: 'email' },
  { key: 'phone', group: 'Contact', label: 'Phone', type: 'text', column: 'phone' },
  { key: 'created_at', group: 'Contact', label: 'Created date', type: 'date', column: 'created_at' },
  { key: 'updated_at', group: 'Contact', label: 'Last updated', type: 'date', column: 'updated_at' },
  // --- Email ---------------------------------------------------------------
  // Its own group rather than buried at the end of Contact — this is what an
  // admin reaches for when checking who can actually be mailed.
  {
    key: 'unsubscribed_all',
    group: 'Email',
    label: 'Unsubscribed from all email',
    type: 'boolean',
    column: 'unsubscribed_all',
  },
  {
    key: 'unsubscribed_years',
    group: 'Email',
    label: 'Unsubscribed from year',
    type: 'multi',
    column: 'unsubscribed_years',
    optionsKey: 'years',
    countColumn: 'unsubscribed_year_count',
    opLabels: {
      includes_any: 'is any of',
      includes_all: 'is all of',
      excludes_any: 'is none of',
      is_not_empty: 'unsubscribed from any year',
      is_empty: 'not unsubscribed from any year',
    },
  },

  // --- Registrations -------------------------------------------------------
  {
    key: 'tournament_years',
    group: 'Registrations',
    label: 'Tournament year',
    type: 'multi',
    column: 'tournament_years',
    optionsKey: 'years',
    countColumn: 'tournaments_attended',
    opLabels: {
      ...REGISTERED_LABELS,
      is_not_empty: 'has ever registered',
      is_empty: 'has never registered',
    },
  },
  {
    key: 'total_registrations',
    group: 'Registrations',
    label: 'Total registrations',
    type: 'number',
    column: 'total_registrations',
  },
  {
    key: 'tournaments_attended',
    group: 'Registrations',
    label: 'Tournaments attended',
    type: 'number',
    column: 'tournaments_attended',
  },
  {
    key: 'payment_statuses',
    group: 'Registrations',
    label: 'Payment status',
    type: 'multi',
    column: 'payment_statuses',
    options: PAYMENT_STATUS_OPTIONS,
    countColumn: 'total_registrations',
  },
  {
    // Same-registration variant of the two conditions above. "Year is 2025" AND
    // "status is paid" are independent once the data is per-contact, so they
    // also match someone who registered in 2025 and paid in a different year;
    // this field asks the question people usually mean.
    key: 'year_payment_statuses',
    group: 'Registrations',
    label: 'Payment status in a specific year',
    type: 'multi',
    column: 'year_payment_statuses',
    optionsKey: 'yearPaymentStatuses',
    countColumn: 'total_registrations',
  },
  {
    key: 'total_amount_paid',
    group: 'Registrations',
    label: 'Total amount paid ($)',
    type: 'number',
    column: 'total_amount_paid',
  },
  {
    key: 'paid_registrations',
    group: 'Registrations',
    label: 'Paid registrations',
    type: 'number',
    column: 'paid_registrations',
  },
  {
    key: 'unpaid_registrations',
    group: 'Registrations',
    label: 'Unpaid registrations',
    type: 'number',
    column: 'unpaid_registrations',
  },
  {
    key: 'last_registration_date',
    group: 'Registrations',
    label: 'Last registration date',
    type: 'date',
    column: 'last_registration_date',
  },
  {
    key: 'first_registration_date',
    group: 'Registrations',
    label: 'First registration date',
    type: 'date',
    column: 'first_registration_date',
  },

  // --- Events --------------------------------------------------------------
  {
    key: 'event_types',
    group: 'Events',
    label: 'Event type (any year)',
    type: 'multi',
    column: 'event_types',
    options: EVENT_TYPE_OPTIONS,
    countColumn: 'distinct_event_types',
    opLabels: REGISTERED_LABELS,
  },
  {
    key: 'event_year_types',
    group: 'Events',
    label: 'Event in a specific year',
    type: 'multi',
    column: 'event_year_types',
    optionsKey: 'eventYearTypes',
    countColumn: 'distinct_event_types',
    opLabels: REGISTERED_LABELS,
  },
  {
    key: 'event_ids',
    group: 'Events',
    label: 'Specific event',
    type: 'multi',
    column: 'event_ids',
    optionsKey: 'events',
    countColumn: 'event_registrations',
    opLabels: REGISTERED_LABELS,
  },
  {
    key: 'total_children',
    group: 'Events',
    label: 'Children registered',
    type: 'number',
    column: 'total_children',
  },
  {
    key: 'event_registrations',
    group: 'Events',
    label: 'Event registrations',
    type: 'number',
    column: 'event_registrations',
  },

  // --- Awards --------------------------------------------------------------
  { key: 'awards_won', group: 'Awards', label: 'Awards won', type: 'number', column: 'awards_won' },
  {
    key: 'award_category_keys',
    group: 'Awards',
    label: 'Award category',
    type: 'multi',
    column: 'award_category_keys',
    optionsKey: 'awardCategories',
    countColumn: 'awards_won',
    opLabels: { is_not_empty: 'has won any award', is_empty: 'has never won an award' },
  },
  {
    key: 'award_years',
    group: 'Awards',
    label: 'Award year',
    type: 'multi',
    column: 'award_years',
    optionsKey: 'years',
    countColumn: 'awards_won',
  },
];

// Fields that only make sense on the Contacts screen. The recipient picker is
// always building an email audience, so a contact's phone is noise there, and
// "unsubscribed" is enforced as a hard suppression rather than offered as a
// filter the admin could accidentally invert.
const RECIPIENT_EXCLUDED = new Set(['phone', 'unsubscribed_all', 'unsubscribed_years']);

export const getContactFilterFields = ({ scope = 'contacts' } = {}) =>
  scope === 'recipients'
    ? CONTACT_FILTER_FIELDS.filter((f) => !RECIPIENT_EXCLUDED.has(f.key))
    : CONTACT_FILTER_FIELDS;

export const buildFieldMap = (fields) => Object.fromEntries(fields.map((f) => [f.key, f]));

export const fieldGroups = (fields) => [...new Set(fields.map((f) => f.group))];

// Default field for a newly added condition — the one the filters exist for.
export const DEFAULT_FIELD_KEY = 'tournament_years';

export const FIELD_MAP = buildFieldMap(CONTACT_FILTER_FIELDS);
