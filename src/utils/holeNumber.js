/**
 * Compares starting-hole labels for sorting. A label is usually a bare number
 * ("7") but a shotgun start can split a hole into simultaneous groups
 * ("1A", "1B"), so this sorts by the numeric part first and any letter suffix
 * second — plain string sorting would put "10" before "2".
 *
 * Nullish values sort last.
 */
export const compareHoleNumbers = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  const parse = (h) => {
    const match = String(h).trim().match(/^(\d+)\s*(.*)$/);
    return match
      ? { num: parseInt(match[1], 10), suffix: match[2].toUpperCase() }
      : { num: Infinity, suffix: String(h).toUpperCase() };
  };

  const pa = parse(a);
  const pb = parse(b);
  return pa.num - pb.num || pa.suffix.localeCompare(pb.suffix);
};
