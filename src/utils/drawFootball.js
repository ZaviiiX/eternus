// src/utils/drawFootball.js

// Fisher–Yates
function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Odabir najboljeg razreza grupa */
export function computeBestGrouping(teamCount) {
  if (teamCount < 3) return [{ size: teamCount, count: 1 }];
  const preferredSizes = [4, 3, 5, 6];
  const candidates = [];

  for (let groups = 1; groups <= teamCount; groups++) {
    const base = Math.floor(teamCount / groups);
    const rem = teamCount % groups;
    if (base < 3) break;

    const sizes = Array(groups).fill(base).map((s, i) => (i < rem ? s + 1 : s));
    if (sizes.some((s) => s < 3 || s > 6)) continue;

    const maxS = Math.max(...sizes);
    const minS = Math.min(...sizes);
    const imbalance = maxS - minS;
    const scorePreferred = sizes.reduce(
      (acc, s) => acc + (s === 4 ? 2 : preferredSizes.includes(s) ? 1 : 0),
      0
    );
    const groupsPenalty = groups * 0.05;
    const score = scorePreferred - imbalance * 2 - groupsPenalty;

    candidates.push({ groups, sizes, score });
  }

  if (!candidates.length) return [{ size: teamCount, count: 1 }];

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0].sizes.sort((a, b) => b - a);
  const map = new Map();
  best.forEach((s) => map.set(s, (map.get(s) || 0) + 1));
  return Array.from(map.entries()).map(([size, count]) => ({ size, count }));
}

/** Nasumično popuni grupe prema razrezu */
export function materializeGroups(teamIds, grouping) {
  const shuffled = shuffle(teamIds);
  const groups = [];
  let cursor = 0;
  grouping.forEach(({ size, count }) => {
    for (let i = 0; i < count; i++) {
      groups.push(shuffled.slice(cursor, cursor + size));
      cursor += size;
    }
  });
  return groups; // [[ids...], ...]
}

/** Berger – round-robin runde za JEDNU grupu (svatko sa svakim, 1x) */
export function roundRobinRoundsForGroup(groupIds) {
  const teams = [...groupIds];
  if (teams.length % 2 === 1) teams.push(null); // bye
  const n = teams.length;
  const rounds = n - 1;
  const schedule = [];

  for (let r = 0; r < rounds; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = teams[i];
      const b = teams[n - 1 - i];
      if (a != null && b != null) pairs.push([a, b]);
    }
    schedule.push(pairs);
    const fixed = teams[0];
    const rest = teams.slice(1);
    rest.unshift(rest.pop());
    teams.splice(0, teams.length, fixed, ...rest);
  }
  return schedule; // [ [ [a,b], ... ], [ ... ], ... ]
}

/** Rr runde za SVE grupe (mapa: label -> rounds[]) */
export function roundRobinRoundsForAllGroups(groups) {
  const map = new Map(); // label => rounds
  groups.forEach((g, gi) => {
    const label = String.fromCharCode(65 + gi);
    map.set(label, roundRobinRoundsForGroup(g));
  });
  return map;
}

/**
 * Globalni raspored: A1,B1,C1,… pa A2,B2,C2,…
 * + izbjegavanje back-to-back za isti tim kad god je moguće.
 */
export function buildInterleavedSchedule(groups) {
  const roundsMap = roundRobinRoundsForAllGroups(groups); // label -> [rounds], round = [ [a,b], ... ]
  const labels = Array.from(roundsMap.keys());

  // stanje po grupi
  const state = new Map();
  let totalMatches = 0;
  labels.forEach((label) => {
    const rounds = roundsMap.get(label).map((pairs) => [...pairs]); // kopije
    const countInLabel = rounds.reduce((acc, r) => acc + r.length, 0);
    totalMatches += countInLabel;
    state.set(label, { rounds, roundIndex: 0 });
  });

  const result = [];
  let lastTeams = new Set(); // timovi iz prethodne utakmice

  function takeOneMatchAvoiding(label) {
    const s = state.get(label);
    while (s.roundIndex < s.rounds.length) {
      const bucket = s.rounds[s.roundIndex];
      if (bucket.length === 0) {
        s.roundIndex++;
        continue;
      }
      const idx = bucket.findIndex(([a, b]) => !lastTeams.has(a) && !lastTeams.has(b));
      const picked = idx !== -1 ? bucket.splice(idx, 1)[0] : bucket.shift();
      return { match: picked, roundNumber: s.roundIndex + 1 };
    }
    return null;
  }

  while (result.length < totalMatches) {
    let anyPickedThisPass = false;
    for (const label of labels) {
      const pick = takeOneMatchAvoiding(label);
      if (!pick) continue;
      const [a, b] = pick.match;
      result.push({
        team_a_id: a,
        team_b_id: b,
        group_label: label,
        round_label: `Skupina ${label} – R${pick.roundNumber}`,
      });
      lastTeams = new Set([a, b]);
      anyPickedThisPass = true;
    }
    if (!anyPickedThisPass) break;
  }

  return result;
}
