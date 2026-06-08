-- One-time cleanup: normalize existing contact phone numbers to a canonical,
-- punctuation-free form so search/dedupe is reliable. Mirrors normalizePhone()
-- in src/utils/phone.js: strip everything except digits, preserving a single
-- leading "+" for international numbers. Empty results become NULL.
--
-- Going forward, the registration form and admin forms normalize on save, so
-- this only needs to run once against existing data.
--
-- Apply via the Supabase dashboard SQL editor, or `supabase db push`.

update public.contacts
set phone = nullif(
  (case when btrim(phone) like '+%' then '+' else '' end)
  || regexp_replace(phone, '[^0-9]', '', 'g'),
  ''
)
where phone is not null
  and phone is distinct from nullif(
    (case when btrim(phone) like '+%' then '+' else '' end)
    || regexp_replace(phone, '[^0-9]', '', 'g'),
    ''
  );
