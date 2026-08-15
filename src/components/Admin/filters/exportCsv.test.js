import { toCsv } from './exportCsv';

const cols = [
  { label: 'Name', get: (r) => r.name },
  { label: 'Note', get: (r) => r.note },
];

const lines = (csv) => csv.replace(/^﻿/, '').split('\r\n');

describe('toCsv', () => {
  it('starts with a BOM and uses CRLF line endings', () => {
    const csv = toCsv([{ name: 'A', note: 'B' }], cols);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('\r\n');
    expect(lines(csv)).toEqual(['Name,Note', 'A,B']);
  });

  it('keeps a value containing a comma in one column', () => {
    const csv = toCsv([{ name: 'Allen, Jonathan', note: 'ok' }], cols);
    expect(lines(csv)[1]).toBe('"Allen, Jonathan",ok');
  });

  it('doubles embedded quotes and quotes embedded newlines', () => {
    const csv = toCsv([{ name: 'He said "hi"', note: 'line1\nline2' }], cols);
    expect(lines(csv)[1]).toBe('"He said ""hi""","line1\nline2"');
  });

  it('neutralises spreadsheet formulas', () => {
    const csv = toCsv(
      [
        { name: '=HYPERLINK("http://evil","x")', note: '+1' },
        { name: '-2', note: '@SUM(A1)' },
      ],
      cols
    );
    const rows = lines(csv);
    // Each dangerous leading character is prefixed with an apostrophe, and the
    // first cell also needs quoting because it contains commas and quotes.
    expect(rows[1]).toBe('"\'=HYPERLINK(""http://evil"",""x"")",\'+1');
    expect(rows[2]).toBe("'-2,'@SUM(A1)");
  });

  it('renders null and undefined as empty', () => {
    const csv = toCsv([{ name: null, note: undefined }], cols);
    expect(lines(csv)[1]).toBe(',');
  });
});
