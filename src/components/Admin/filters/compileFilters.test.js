import {
  quote,
  likeEscape,
  compileCondition,
  compileNode,
  buildSearchFragment,
  buildFilterFragment,
  countCompiledConditions,
} from './compileFilters';
import { makeCondition, makeGroup } from './filterModel';

const cond = (field, operator, value) => ({ kind: 'condition', field, operator, value });
const group = (conjunction, children) => ({ kind: 'group', conjunction, children });

describe('escaping', () => {
  it('quotes and escapes backslashes and double quotes', () => {
    expect(quote('plain')).toBe('"plain"');
    expect(quote('a,b(c)')).toBe('"a,b(c)"');
    expect(quote('say "hi"')).toBe('"say \\"hi\\""');
    expect(quote('back\\slash')).toBe('"back\\\\slash"');
  });

  it('escapes LIKE metacharacters', () => {
    expect(likeEscape('100%')).toBe('100\\%');
    expect(likeEscape('a_b')).toBe('a\\_b');
    expect(likeEscape('c:\\tmp')).toBe('c:\\\\tmp');
  });
});

describe('text conditions', () => {
  it('compiles contains with wildcards around the escaped term', () => {
    expect(compileCondition(cond('email', 'contains', 'gmail'))).toBe('email.ilike."%gmail%"');
  });

  it('treats empty as null OR blank string', () => {
    expect(compileCondition(cond('email', 'is_empty'))).toBe('or(email.is.null,email.eq."")');
    expect(compileCondition(cond('email', 'is_not_empty'))).toBe(
      'and(email.not.is.null,email.neq."")'
    );
  });

  it('keeps negation NULL-safe so contacts with no value still match', () => {
    expect(compileCondition(cond('email', 'not_contains', 'gmail'))).toBe(
      'or(email.is.null,email.not.ilike."%gmail%")'
    );
    expect(compileCondition(cond('last_name', 'not_equals', 'Allen'))).toBe(
      'or(last_name.is.null,last_name.not.ilike."Allen")'
    );
  });

  it('neutralises delimiters and wildcards in user input', () => {
    // A term that would otherwise terminate the value and inject a condition.
    expect(compileCondition(cond('full_name', 'contains', 'Smith, J)'))).toBe(
      'full_name.ilike."%Smith, J)%"'
    );
    // A literal % must not become a wildcard. The `\` that likeEscape adds is
    // itself doubled by quote(), so PostgREST unescapes it back to a single `\`
    // and Postgres sees the pattern `%50\%%` — a literal percent sign.
    expect(compileCondition(cond('full_name', 'contains', '50%'))).toBe(
      'full_name.ilike."%50\\\\%%"'
    );
  });

  it('ignores a half-typed row', () => {
    expect(compileCondition(cond('email', 'contains', ''))).toBeNull();
    expect(compileCondition(cond('email', 'contains', '   '))).toBeNull();
  });
});

describe('number conditions', () => {
  it('compiles comparisons without quoting numerics', () => {
    expect(compileCondition(cond('awards_won', 'gt', 0))).toBe('awards_won.gt.0');
    expect(compileCondition(cond('awards_won', 'gte', '2'))).toBe('awards_won.gte.2');
    expect(compileCondition(cond('total_registrations', 'lte', 3))).toBe(
      'total_registrations.lte.3'
    );
  });

  it('orders a reversed between range', () => {
    expect(compileCondition(cond('total_amount_paid', 'between', ['500', '100']))).toBe(
      'and(total_amount_paid.gte.100,total_amount_paid.lte.500)'
    );
  });

  it('rejects non-numeric and incomplete input', () => {
    expect(compileCondition(cond('awards_won', 'gt', 'abc'))).toBeNull();
    expect(compileCondition(cond('awards_won', 'between', ['1', '']))).toBeNull();
  });
});

describe('multi (array column) conditions', () => {
  it('emits one single-element literal per value, never a comma-separated one', () => {
    const anyOf = compileCondition(cond('tournament_years', 'includes_any', [2024, 2025]));
    expect(anyOf).toBe('or(tournament_years.cs.{2024},tournament_years.cs.{2025})');
    expect(anyOf).not.toMatch(/\{[^}]*,[^}]*\}/);
  });

  it('compiles "is all of" as a conjunction', () => {
    expect(compileCondition(cond('tournament_years', 'includes_all', [2024, 2025]))).toBe(
      'and(tournament_years.cs.{2024},tournament_years.cs.{2025})'
    );
  });

  it('compiles "is none of" as a conjunction of negations', () => {
    expect(compileCondition(cond('tournament_years', 'excludes_any', [2025]))).toBe(
      'tournament_years.not.cs.{2025}'
    );
    expect(compileCondition(cond('event_types', 'excludes_any', ['beach_day', 'welcome_dinner']))).toBe(
      'and(event_types.not.cs.{beach_day},event_types.not.cs.{welcome_dinner})'
    );
  });

  it('uses the scalar companion column for has any / has none', () => {
    expect(compileCondition(cond('tournament_years', 'is_empty'))).toBe('tournaments_attended.eq.0');
    expect(compileCondition(cond('award_category_keys', 'is_not_empty'))).toBe('awards_won.gt.0');
  });

  it('ignores an empty selection', () => {
    expect(compileCondition(cond('tournament_years', 'includes_any', []))).toBeNull();
  });
});

describe('boolean and date conditions', () => {
  it('treats a null boolean as "no"', () => {
    expect(compileCondition(cond('unsubscribed_all', 'is_true'))).toBe('unsubscribed_all.is.true');
    expect(compileCondition(cond('unsubscribed_all', 'is_false'))).toBe(
      'or(unsubscribed_all.is.false,unsubscribed_all.is.null)'
    );
  });

  it('expands a single day into a bounded range', () => {
    const out = compileCondition(cond('created_at', 'on', '2026-08-15'));
    expect(out).toMatch(/^and\(created_at\.gte\."[^"]+",created_at\.lte\."[^"]+"\)$/);
  });

  it('resolves relative day counts to an absolute cutoff', () => {
    expect(compileCondition(cond('last_registration_date', 'in_last_days', '90'))).toMatch(
      /^last_registration_date\.gte\."\d{4}-\d{2}-\d{2}T/
    );
    expect(compileCondition(cond('last_registration_date', 'in_last_days', '-1'))).toBeNull();
  });
});

describe('unknown fields and operators', () => {
  it('drops conditions the registry no longer recognises', () => {
    expect(compileCondition(cond('no_such_field', 'contains', 'x'))).toBeNull();
    expect(compileCondition(cond('email', 'no_such_operator', 'x'))).toBeNull();
    // An operator valid for another type must not leak across.
    expect(compileCondition(cond('email', 'gt', '5'))).toBeNull();
  });
});

describe('nested groups', () => {
  it('nests AND inside OR and vice versa', () => {
    const tree = group('and', [
      cond('email', 'is_not_empty'),
      group('or', [
        cond('tournament_years', 'includes_any', [2025]),
        cond('awards_won', 'gt', 0),
      ]),
    ]);
    expect(compileNode(tree)).toBe(
      'and(and(email.not.is.null,email.neq.""),or(tournament_years.cs.{2025},awards_won.gt.0))'
    );
  });

  it('nests three levels deep', () => {
    const tree = group('or', [
      cond('awards_won', 'gt', 0),
      group('and', [
        cond('tournament_years', 'includes_any', [2025]),
        group('or', [
          cond('event_types', 'includes_any', ['beach_day']),
          cond('total_children', 'gt', 0),
        ]),
      ]),
    ]);
    expect(compileNode(tree)).toBe(
      'or(awards_won.gt.0,and(tournament_years.cs.{2025},or(event_types.cs.{beach_day},total_children.gt.0)))'
    );
  });

  it('collapses a single-child group and drops empty ones', () => {
    expect(compileNode(group('and', [cond('awards_won', 'gt', 0)]))).toBe('awards_won.gt.0');
    expect(compileNode(group('and', []))).toBeNull();
    expect(compileNode(group('and', [group('or', [])]))).toBeNull();
  });

  it('drops incomplete children without discarding their siblings', () => {
    const tree = group('and', [
      cond('email', 'contains', ''),
      cond('awards_won', 'gt', 1),
    ]);
    expect(compileNode(tree)).toBe('awards_won.gt.1');
  });

  it('balances parentheses at every nesting level', () => {
    const tree = group('and', [
      cond('email', 'is_empty'),
      group('or', [
        cond('tournament_years', 'excludes_any', [2024, 2025]),
        cond('created_at', 'between', ['2026-01-01', '2026-12-31']),
      ]),
    ]);
    const out = compileNode(tree);
    const opens = (out.match(/\(/g) || []).length;
    const closes = (out.match(/\)/g) || []).length;
    expect(opens).toBe(closes);
  });
});

describe('search and full fragment', () => {
  it('searches name, email and phone', () => {
    expect(buildSearchFragment('allen')).toBe(
      'or(full_name.ilike."%allen%",email.ilike."%allen%",phone.ilike."%allen%")'
    );
    expect(buildSearchFragment('   ')).toBeNull();
  });

  it('escapes a search term that would otherwise break the query', () => {
    expect(buildSearchFragment('a,b)')).toBe(
      'or(full_name.ilike."%a,b)%",email.ilike."%a,b)%",phone.ilike."%a,b)%")'
    );
  });

  it('ANDs the search with the tree even when the tree root is OR', () => {
    const tree = group('or', [
      cond('awards_won', 'gt', 0),
      cond('tournament_years', 'includes_any', [2025]),
    ]);
    expect(buildFilterFragment({ searchTerm: 'allen', tree })).toBe(
      'and(or(full_name.ilike."%allen%",email.ilike."%allen%",phone.ilike."%allen%"),' +
        'or(awards_won.gt.0,tournament_years.cs.{2025}))'
    );
  });

  it('returns null when nothing constrains the query', () => {
    expect(buildFilterFragment({ searchTerm: '', tree: group('and', []) })).toBeNull();
    expect(buildFilterFragment({})).toBeNull();
  });

  it('omits the wrapper when only one side is present', () => {
    expect(buildFilterFragment({ tree: group('and', [cond('awards_won', 'gt', 0)]) })).toBe(
      'awards_won.gt.0'
    );
  });
});

describe('countCompiledConditions', () => {
  it('counts only conditions that constrain the query', () => {
    const tree = group('and', [
      cond('email', 'contains', ''), // incomplete
      cond('awards_won', 'gt', 0),
      group('or', [
        cond('tournament_years', 'includes_any', []), // incomplete
        cond('tournament_years', 'includes_any', [2025]),
      ]),
    ]);
    expect(countCompiledConditions(tree)).toBe(2);
    expect(countCompiledConditions(group('and', []))).toBe(0);
  });
});

describe('model helpers produce compilable nodes', () => {
  it('round-trips a tree built through the constructors', () => {
    const tree = makeGroup('and', [
      makeCondition('awards_won', 'gt', '0'),
      makeGroup('or', [makeCondition('tournament_years', 'includes_any', [2025])]),
    ]);
    expect(compileNode(tree)).toBe('and(awards_won.gt.0,tournament_years.cs.{2025})');
  });
});
