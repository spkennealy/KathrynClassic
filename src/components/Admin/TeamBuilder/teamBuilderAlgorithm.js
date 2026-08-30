/**
 * Team Builder Algorithm
 *
 * Takes a list of golf registrants and produces suggested 4-person teams
 * based on registration groups and preferred-teammate data.
 *
 * @param {Array} golfers - Array of golfer objects:
 *   { id, contact_id, first_name, last_name, golf_handicap, preferred_teammates, registration_group_id }
 * @param {Set|Array} existingTeamContactIds - contact_ids already assigned to a team
 * @param {Object} [options]
 * @param {Array} [options.priorTeams] - team identities from past years:
 *   { id, name, lastPlayed, roster: [contact_id] }. A suggestion containing any of
 *   a past team's players is re-entered under that team rather than named "Team N".
 * @param {Set|Array} [options.claimedTeamIds] - team identities already used this
 *   year, which can't be re-entered again.
 * @returns {{ suggestedTeams: Array, unassigned: Array }}
 */
export function buildTeamSuggestions(golfers, existingTeamContactIds = [], options = {}) {
  const onTeam = new Set(
    Array.isArray(existingTeamContactIds)
      ? existingTeamContactIds
      : [...existingTeamContactIds]
  );

  // 1. Filter out golfers already on a team
  const available = golfers.filter((g) => !onTeam.has(g.contact_id));

  // 2. Group by registration_group_id
  const groupMap = new Map(); // group_id → [golfer, ...]
  const ungrouped = [];

  available.forEach((g) => {
    if (g.registration_group_id) {
      if (!groupMap.has(g.registration_group_id)) {
        groupMap.set(g.registration_group_id, []);
      }
      groupMap.get(g.registration_group_id).push(g);
    } else {
      ungrouped.push(g);
    }
  });

  // 3. Build preference links (fuzzy name matching)
  const preferenceMap = buildPreferenceMap(available);

  const suggestedTeams = [];
  const assigned = new Set(); // contact_ids placed in a suggestion

  // Helper: mark golfers as assigned
  const markAssigned = (members) => {
    members.forEach((m) => assigned.add(m.contact_id));
  };

  // Helper: get unassigned from a list
  const getUnassigned = (list) => list.filter((g) => !assigned.has(g.contact_id));

  // 4a. Process groups of exactly 4 → complete teams
  for (const [groupId, members] of groupMap) {
    if (members.length === 4) {
      suggestedTeams.push({
        members: members.map((m) => ({
          ...m,
          reasons: ['Registered together'],
        })),
        name: `Team ${suggestedTeams.length + 1}`,
      });
      markAssigned(members);
    }
  }

  // 4b. Groups > 4 → split into chunks of 4
  for (const [groupId, members] of groupMap) {
    const remaining = getUnassigned(members);
    if (remaining.length > 4) {
      const chunks = chunkArray(remaining, 4);
      chunks.forEach((chunk) => {
        if (chunk.length === 4) {
          suggestedTeams.push({
            members: chunk.map((m) => ({
              ...m,
              reasons: ['Registered together'],
            })),
            name: `Team ${suggestedTeams.length + 1}`,
          });
          markAssigned(chunk);
        }
      });
    }
  }

  // 4c. Groups of 3 → find a 4th
  for (const [groupId, members] of groupMap) {
    const remaining = getUnassigned(members);
    if (remaining.length === 3) {
      const fourth = findBestMatch(remaining, preferenceMap, assigned, ungrouped, available);
      if (fourth) {
        suggestedTeams.push({
          members: [
            ...remaining.map((m) => ({ ...m, reasons: ['Registered together'] })),
            { ...fourth.golfer, reasons: fourth.reasons },
          ],
          name: `Team ${suggestedTeams.length + 1}`,
        });
        markAssigned([...remaining, fourth.golfer]);
      } else {
        // No match found, still create the 3-person suggestion
        suggestedTeams.push({
          members: remaining.map((m) => ({ ...m, reasons: ['Registered together'] })),
          name: `Team ${suggestedTeams.length + 1}`,
        });
        markAssigned(remaining);
      }
    }
  }

  // 4d. Groups of 2 → merge with another pair or fill
  const pairs = [];
  for (const [groupId, members] of groupMap) {
    const remaining = getUnassigned(members);
    if (remaining.length === 2) {
      pairs.push(remaining);
    }
  }

  // Try to merge pairs
  const usedPairs = new Set();
  for (let i = 0; i < pairs.length; i++) {
    if (usedPairs.has(i)) continue;
    let bestPairIdx = -1;
    let bestScore = -1;

    for (let j = i + 1; j < pairs.length; j++) {
      if (usedPairs.has(j)) continue;
      const score = mutualPreferenceScore(pairs[i], pairs[j], preferenceMap);
      if (score > bestScore) {
        bestScore = score;
        bestPairIdx = j;
      }
    }

    if (bestPairIdx >= 0) {
      usedPairs.add(i);
      usedPairs.add(bestPairIdx);
      const merged = [...pairs[i], ...pairs[bestPairIdx]];
      suggestedTeams.push({
        members: merged.map((m) => {
          const reasons = ['Registered together'];
          // Check if any member from the other pair preferred this one
          const otherPair = pairs[i].includes(m) ? pairs[bestPairIdx] : pairs[i];
          otherPair.forEach((other) => {
            if (preferenceMap.get(other.contact_id)?.has(m.contact_id)) {
              reasons.push(`Preferred by ${other.first_name}`);
            }
          });
          return { ...m, reasons };
        }),
        name: `Team ${suggestedTeams.length + 1}`,
      });
      markAssigned(merged);
    }
  }

  // Remaining unpaired pairs → fill from ungrouped/preference pool
  for (let i = 0; i < pairs.length; i++) {
    if (usedPairs.has(i)) continue;
    usedPairs.add(i);
    const pair = pairs[i];
    const fillers = findFillers(pair, 2, preferenceMap, assigned, ungrouped, available);
    const teamMembers = [
      ...pair.map((m) => ({ ...m, reasons: ['Registered together'] })),
      ...fillers.map((f) => ({ ...f.golfer, reasons: f.reasons })),
    ];
    suggestedTeams.push({
      members: teamMembers,
      name: `Team ${suggestedTeams.length + 1}`,
    });
    markAssigned([...pair, ...fillers.map((f) => f.golfer)]);
  }

  // 4e. Remaining ungrouped → cluster by preference links, then fill
  let pool = getUnassigned([...ungrouped, ...available]);

  while (pool.length >= 4) {
    // Try to find a cluster of 4 via preferences
    const cluster = buildCluster(pool, preferenceMap, 4);
    if (cluster.length >= 2) {
      // Fill rest from pool
      const needed = 4 - cluster.length;
      const rest = pool.filter(
        (g) => !cluster.find((c) => c.contact_id === g.contact_id)
      );
      const fillers = rest.slice(0, needed);
      const teamMembers = [
        ...cluster.map((m) => ({
          ...m,
          reasons: getPreferenceReasons(m, cluster, preferenceMap),
        })),
        ...fillers.map((m) => ({
          ...m,
          reasons: getPreferenceReasons(m, [...cluster, ...fillers], preferenceMap),
        })),
      ];

      suggestedTeams.push({
        members: teamMembers,
        name: `Team ${suggestedTeams.length + 1}`,
      });
      markAssigned([...cluster, ...fillers]);
      pool = getUnassigned(pool);
    } else {
      // No preference links; just group the first 4
      const batch = pool.slice(0, 4);
      suggestedTeams.push({
        members: batch.map((m) => ({ ...m, reasons: [] })),
        name: `Team ${suggestedTeams.length + 1}`,
      });
      markAssigned(batch);
      pool = getUnassigned(pool);
    }
  }

  // 5. Carry team identities forward where a suggestion contains past players
  assignReturningTeams(suggestedTeams, options.priorTeams || [], options.claimedTeamIds || []);

  // 6. Leftovers → unassigned
  const unassigned = available.filter((g) => !assigned.has(g.contact_id));

  return { suggestedTeams, unassigned };
}

/**
 * Links suggestions to the team identities their players have played for before, so
 * a family or organisation that enters every year keeps its name even when the
 * line-up changes. One returning player is enough to claim the identity.
 *
 * Mutates `suggestedTeams` in place: sets `teams_id`, renames the team, and tags the
 * players it recognised. Strongest links are resolved first (most returning players,
 * then most recent year), and each identity is used at most once.
 */
function assignReturningTeams(suggestedTeams, priorTeams, claimedTeamIds) {
  if (!priorTeams.length) return;
  const claimed = new Set(claimedTeamIds);

  const candidates = [];
  suggestedTeams.forEach((team, teamIdx) => {
    const memberIds = new Set(team.members.map((m) => m.contact_id).filter(Boolean));
    priorTeams.forEach((prior) => {
      if (claimed.has(prior.id)) return;
      const matched = (prior.roster || []).filter((id) => memberIds.has(id));
      if (matched.length === 0) return;
      candidates.push({ teamIdx, prior, matched, score: matched.length });
    });
  });

  candidates.sort(
    (a, b) => b.score - a.score || (b.prior.lastPlayed || 0) - (a.prior.lastPlayed || 0)
  );

  const usedSuggestions = new Set();
  for (const candidate of candidates) {
    if (usedSuggestions.has(candidate.teamIdx) || claimed.has(candidate.prior.id)) continue;
    usedSuggestions.add(candidate.teamIdx);
    claimed.add(candidate.prior.id);

    const team = suggestedTeams[candidate.teamIdx];
    const matched = new Set(candidate.matched);
    team.teams_id = candidate.prior.id;
    team.name = candidate.prior.name;
    team.lastPlayed = candidate.prior.lastPlayed ?? null;
    team.members = team.members.map((m) =>
      matched.has(m.contact_id)
        ? { ...m, reasons: [...(m.reasons || []), 'Returning team'] }
        : m
    );
  }
}

// --- Helpers ---

/**
 * Scores how well a written preference matches a registered golfer. People rarely
 * write a full name — "mike", "Mike W", "woodruff" — so this ranks the plausible
 * readings instead of taking whatever matches first. 0 means no match.
 */
export function scoreNameMatch(pref, other) {
  const first = (other.first_name || '').toLowerCase().trim();
  const last = (other.last_name || '').toLowerCase().trim();
  const full = `${first} ${last}`.trim();
  const needle = (pref || '').toLowerCase().trim();
  if (!needle || !full) return 0;

  // "the Woodruffs", "Graham's" — people pluralise and possessive surnames.
  const singular = (word) => word.replace(/['\u2019]s$/, '').replace(/s$/, '');

  if (needle === full) return 100;

  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const pFirst = tokens[0];
    const pLast = tokens[tokens.length - 1];
    if (pFirst === first && pLast === last) return 95;
    // "mike w" / "mike wood" — first name exact, surname abbreviated
    if (pFirst === first && last.startsWith(pLast)) return 90;
    if (first.startsWith(pFirst) && last.startsWith(pLast)) return 80;
    // "the woodruffs", "woodruff family" — surname mentioned among other words
    if (tokens.some((t) => t === last || singular(t) === last)) return 60;
    return 0;
  }

  if (needle === first) return 70;
  if (needle === last) return 70;
  if (singular(needle) === last) return 65;
  // Short fragments are too easy to collide with; require a real prefix.
  if (needle.length >= 3 && first.startsWith(needle)) return 55;
  if (needle.length >= 3 && last.startsWith(needle)) return 55;
  if (needle.length >= 4 && full.includes(needle)) return 40;
  return 0;
}

function buildPreferenceMap(golfers) {
  // Map: contact_id → Set of contact_ids they prefer
  const map = new Map();
  golfers.forEach((g) => {
    if (!g.preferred_teammates) return;
    // People separate names with commas, "and", "&" or slashes.
    const prefs = g.preferred_teammates
      .split(/,|\band\b|&|\/|\+|;/i)
      .map((s) => s.trim())
      .filter(Boolean);

    const matched = new Set();
    prefs.forEach((prefName) => {
      let best = null;
      let bestScore = 0;
      let tiedAtBest = 0;

      golfers.forEach((other) => {
        if (other.contact_id === g.contact_id) return;
        const score = scoreNameMatch(prefName, other);
        if (score === 0) return;
        if (score > bestScore) {
          bestScore = score;
          best = other;
          tiedAtBest = 1;
        } else if (score === bestScore) {
          tiedAtBest++;
        }
      });

      // An ambiguous name (two Mikes, and they only wrote "Mike") is left
      // unmatched rather than guessed — the admin can still drag them together.
      if (best && tiedAtBest === 1) matched.add(best.contact_id);
    });

    if (matched.size > 0) {
      map.set(g.contact_id, matched);
    }
  });
  return map;
}

function findBestMatch(groupMembers, preferenceMap, assigned, ungrouped, allAvailable) {
  // Exclude group members themselves from being returned as matches
  const groupIds = new Set(groupMembers.map((m) => m.contact_id));

  // Look for someone preferred by a group member who isn't assigned yet
  for (const member of groupMembers) {
    const prefs = preferenceMap.get(member.contact_id);
    if (prefs) {
      for (const prefId of prefs) {
        if (!assigned.has(prefId) && !groupIds.has(prefId)) {
          const golfer = allAvailable.find((g) => g.contact_id === prefId);
          if (golfer) {
            return { golfer, reasons: [`Preferred by ${member.first_name}`] };
          }
        }
      }
    }
  }

  // Look for someone who prefers a group member
  for (const [contactId, prefs] of preferenceMap) {
    if (assigned.has(contactId) || groupIds.has(contactId)) continue;
    for (const member of groupMembers) {
      if (prefs.has(member.contact_id)) {
        const golfer = allAvailable.find((g) => g.contact_id === contactId);
        if (golfer) {
          return { golfer, reasons: [`Prefers ${member.first_name}`] };
        }
      }
    }
  }

  // Fall back to first ungrouped
  const fallback = ungrouped.find((g) => !assigned.has(g.contact_id));
  if (fallback) {
    return { golfer: fallback, reasons: [] };
  }

  return null;
}

function findFillers(groupMembers, count, preferenceMap, assigned, ungrouped, allAvailable) {
  const fillers = [];
  const localAssigned = new Set(assigned);
  // Exclude group members from being selected as fillers
  groupMembers.forEach((m) => localAssigned.add(m.contact_id));

  for (let i = 0; i < count; i++) {
    const match = findBestMatch(groupMembers, preferenceMap, localAssigned, ungrouped, allAvailable);
    if (match) {
      fillers.push(match);
      localAssigned.add(match.golfer.contact_id);
    }
  }
  return fillers;
}

function mutualPreferenceScore(pairA, pairB, preferenceMap) {
  let score = 0;
  for (const a of pairA) {
    for (const b of pairB) {
      if (preferenceMap.get(a.contact_id)?.has(b.contact_id)) score++;
      if (preferenceMap.get(b.contact_id)?.has(a.contact_id)) score++;
    }
  }
  return score;
}

function buildCluster(pool, preferenceMap, maxSize) {
  // Start from the golfer with the most preference links in pool
  const poolIds = new Set(pool.map((g) => g.contact_id));
  let bestStart = null;
  let bestCount = 0;

  for (const g of pool) {
    const prefs = preferenceMap.get(g.contact_id);
    if (prefs) {
      const count = [...prefs].filter((id) => poolIds.has(id)).length;
      if (count > bestCount) {
        bestCount = count;
        bestStart = g;
      }
    }
  }

  if (!bestStart) return [pool[0]];

  const cluster = [bestStart];
  const clusterIds = new Set([bestStart.contact_id]);

  while (cluster.length < maxSize) {
    let bestNext = null;
    let bestScore = -1;

    for (const candidate of pool) {
      if (clusterIds.has(candidate.contact_id)) continue;
      let score = 0;
      for (const member of cluster) {
        if (preferenceMap.get(member.contact_id)?.has(candidate.contact_id)) score++;
        if (preferenceMap.get(candidate.contact_id)?.has(member.contact_id)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestNext = candidate;
      }
    }

    if (!bestNext || bestScore === 0) break;
    cluster.push(bestNext);
    clusterIds.add(bestNext.contact_id);
  }

  return cluster;
}

function getPreferenceReasons(golfer, teamMembers, preferenceMap) {
  const reasons = [];
  for (const other of teamMembers) {
    if (other.contact_id === golfer.contact_id) continue;
    if (preferenceMap.get(other.contact_id)?.has(golfer.contact_id)) {
      reasons.push(`Preferred by ${other.first_name}`);
    }
  }
  return reasons;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
