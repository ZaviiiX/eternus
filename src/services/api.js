import { createClient } from "@supabase/supabase-js";

// --- init ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const SUPABASE_AVAILABLE = Boolean(supabaseUrl && supabaseAnonKey);

if (!SUPABASE_AVAILABLE) {
  console.warn(
    "Supabase env vars not set — using noop client. Network calls will be no-ops.",
    { supabaseUrl, hasKey: !!supabaseAnonKey }
  );
}

// create a noop chainable builder for .from(...).select(...).eq(...)
function createFromStub() {
  const empty = { data: [], error: null, status: 200 };
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    order() { return builder; },
    limit() { return builder; },
    in() { return builder; },
    insert() { return Promise.resolve({ data: [], error: null }); },
    update() { return Promise.resolve({ data: [], error: null }); },
    delete() { return Promise.resolve({ data: [], error: null }); },
    maybeSingle() { return Promise.resolve({ data: null, error: null, status: 406 }); },
    single() { return Promise.resolve({ data: null, error: null }); },
    then(resolve) { return Promise.resolve(empty).then(resolve); },
  };
  return builder;
}

function createChannelStub() {
  const ch = {
    on() { return ch; },
    subscribe() { return { data: { subscription: { unsubscribe() {} } } }; },
  };
  return ch;
}

export const supabase = SUPABASE_AVAILABLE
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      from: () => createFromStub(),
      channel: () => createChannelStub(),
      removeChannel: () => {},
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithPassword: async () => ({ data: null, error: { message: "Supabase not configured" } }),
        signOut: async () => ({}),
      },
    };

// -------- PUBLIC --------
export async function getSports(seasonId) {
  const q = supabase.from("sports").select("*");
  const { data, error } = seasonId ? await q.eq("season_id", seasonId) : await q;
  if (error) throw error;
  return data;
}

export async function getPublicTeams(sportId) {
  const { data, error } = await supabase
    .from("teams")
    .select("id,name")
    .eq("sport_id", sportId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getPublicMatchesBySport(sportId) {
  const { data, error } = await supabase
    .from("v_public_matches")
    .select("*")
    .eq("sport_id", sportId)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data;
}

// Public matches (general) — base (teams/scores) + extended (clock)
export async function getPublicMatches() {
  // 1) Base shape — sigurno radi (FK projekcije za imena timova)
  const { data: base, error: baseErr } = await supabase
    .from("matches")
    .select(`
      id,
      score_a,
      score_b,
      start_time,
      team_a:team_a_id ( name ),
      team_b:team_b_id ( name )
    `)
    .order("start_time", { ascending: true });
  if (baseErr) throw baseErr;

  const baseMap = (base || []).reduce((acc, m) => {
    acc[m.id] = m;
    return acc;
  }, {});

  // 2) Extended clock polja — samo ako okolina podržava
  try {
    if (await ensureExtendedSelectsSupported()) {
      const { data: ext } = await supabase
        .from("matches")
        .select(`
          id,
          is_running,
          status,
          duration_seconds,
          elapsed_seconds,
          last_started_at
        `)
        .order("start_time", { ascending: true });
      if (ext) {
        ext.forEach((e) => {
          if (baseMap[e.id]) baseMap[e.id] = { ...baseMap[e.id], ...e };
        });
      }
    }
  } catch {
    // ignore — probe sprječava ponavljanje
  }

  // Timer isključivo iz clock polja (bez start_time inferiranja)
  return Object.values(baseMap).map((m) => {
    const is_running = Boolean(m.is_running);
    let elapsed = Number(m.elapsed_seconds ?? 0);
    if (is_running && m.last_started_at) {
      const delta = Math.floor((Date.now() - new Date(m.last_started_at)) / 1000);
      elapsed += delta;
    }
    const duration = Number(m.duration_seconds ?? 600);

    // status: respektiraj 'finished' ako ga ručno postavljaš; inače live/scheduled
    const status = m?.status === "finished" ? "finished" : (is_running ? "live" : "scheduled");

    return {
      id: m.id,
      team_a_name: m.team_a?.name || "-",
      team_b_name: m.team_b?.name || "-",
      score_a: m.score_a,
      score_b: m.score_b,
      start_time: m.start_time,
      is_running,
      status,
      duration_seconds: duration,
      elapsed_seconds: elapsed,
      last_started_at: m.last_started_at || null,
    };
  });
}

export async function getRecentMatches(limit = 5) {
  const { data, error } = await supabase
    .from("matches")
    .select(`
      id,
      score_a,
      score_b,
      start_time,
      team_a:team_a_id ( name ),
      team_b:team_b_id ( name )
    `)
    .order("start_time", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((m) => ({
    title: `${m.team_a?.name || "-"} ${m.score_a ?? "-"}:${m.score_b ?? "-"} ${m.team_b?.name || "-"}`,
    value: "Završena utakmica",
    date: m.start_time ? new Date(m.start_time).toLocaleString("hr-HR") : "",
  }));
}

export async function getStandings(sportId) {
  const { data, error } = await supabase
    .from("v_standings")
    .select("*")
    .eq("sport_id", sportId)
    .order("points", { ascending: false });
  if (error) throw error;
  return data;
}

// -------- AUTH --------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data; // { user, session }
}

export async function signOut() {
  await supabase.auth.signOut();
}

// -------- MATCHES (admin) --------
export async function getMatchesBySport(sportId) {
  const { data, error } = await supabase
    .from("matches")
    .select("id,round,group_label,team_a_id,team_b_id,score_a,score_b,start_time")
    .eq("sport_id", sportId)
    .order("start_time", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMatch({ sport_id, team_a_id, team_b_id, start_time, round = null, group_label = null }) {
  const { data, error } = await supabase
    .from("matches")
    .insert({ sport_id, team_a_id, team_b_id, start_time, round, group_label })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Bulk insert utakmica (za pametni ždrijeb)
export async function createMatchesBulk(matches) {
  const { data, error } = await supabase
    .from("matches")
    .insert(matches)
    .select();
  if (error) throw error;
  return data;
}

export async function updateMatchScore(matchId, score_a, score_b) {
  const { data, error } = await supabase
    .from("matches")
    .update({ score_a, score_b })
    .eq("id", matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMatchResult(matchId, patch) {
  const { data, error } = await supabase
    .from("matches")
    .update(patch)
    .eq("id", matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// -------- TEAMS (admin) --------
export async function getTeamsBySport(sportId) {
  const { data, error } = await supabase
    .from("teams")
    .select("id,name,logo_url,created_at")
    .eq("sport_id", sportId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function createTeam(sportId, name) {
  const { data, error } = await supabase
    .from("teams")
    .insert({ sport_id: sportId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTeam(teamId) {
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw error;
  return true;
}

// -------- PLAYERS (admin) --------
export async function getPlayers(teamId) {
  const { data, error } = await supabase
    .from("players")
    .select("id,first_name,last_name")
    .eq("team_id", teamId)
    .order("last_name");
  if (error) throw error;
  return data;
}

export async function addPlayer(teamId, first_name, last_name) {
  const { data, error } = await supabase
    .from("players")
    .insert({ team_id: teamId, first_name, last_name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removePlayer(playerId) {
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) throw error;
  return true;
}

export async function getMatchById(matchId) {
  // Base fetch
  const { data: base, error: baseErr } = await supabase
    .from("matches")
    .select("id,sport_id,team_a_id,team_b_id,score_a,score_b,start_time,round,group_label")
    .eq("id", matchId)
    .single();
  if (baseErr) throw baseErr;

  // Extended clock polja (ako su dopuštena)
  try {
    if (await ensureExtendedSelectsSupported()) {
      const { data: ext } = await supabase
        .from("matches")
        .select("id,is_running,status,duration_seconds,elapsed_seconds,last_started_at")
        .eq("id", matchId)
        .single();
      if (ext) return { ...base, ...ext };
    }
  } catch {
    // ignore
  }
  return base;
}

// One-time probe: null = unknown, true/false = supported or not
let _extendedSelectsSupported = null;

export async function ensureExtendedSelectsSupported() {
  if (typeof _extendedSelectsSupported === "boolean") return _extendedSelectsSupported;
  try {
    const { error } = await supabase
      .from("matches")
      .select("is_running,duration_seconds,elapsed_seconds,last_started_at,status")
      .limit(1);
    _extendedSelectsSupported = !error;
  } catch {
    _extendedSelectsSupported = false;
  }
  return _extendedSelectsSupported;
}

export async function getTeamsByIds(ids) {
  const { data, error } = await supabase
    .from("teams")
    .select("id,name")
    .in("id", ids);
  if (error) throw error;
  return data;
}

export async function getPlayersByTeam(teamId) {
  const { data, error } = await supabase
    .from("players")
    .select("id,first_name,last_name")
    .eq("team_id", teamId)
    .order("last_name");
  if (error) throw error;
  return data;
}

// GOALS
export async function getGoalsByMatch(matchId) {
  const { data, error } = await supabase
    .from("goals")
    .select("id,match_id,team_id,player_id,minute,created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addGoal({ match_id, team_id, player_id = null, minute = null }) {
  const { data, error } = await supabase
    .from("goals")
    .insert({ match_id, team_id, player_id, minute })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(goalId) {
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
  return true;
}

// helper: “undo” zadnji gol za tim u tom meču
export async function undoLastGoal(matchId, teamId) {
  const { data, error } = await supabase
    .from("goals")
    .select("id,created_at")
    .eq("match_id", matchId)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data?.length) return false;
  await deleteGoal(data[0].id);
  return true;
}

// ---- MATCH CLOCK HELPERS ----
export async function patchMatch(matchId, patch) {
  const { data, error } = await supabase
    .from("matches")
    .update(patch)
    .eq("id", matchId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function startClock(match) {
  if (match.is_running) return match;
  const duration = Number(match.duration_seconds || 600);
  const elapsed = Number(match.elapsed_seconds || 0);
  const resetElapsed = elapsed >= duration ? 0 : elapsed;
  return patchMatch(match.id, {
    is_running: true,
    last_started_at: new Date().toISOString(),
    status: "live",
    elapsed_seconds: resetElapsed,
  });
}

export async function pauseClock(match) {
  if (!match.is_running) return match;
  const now = Date.now();
  const last = match.last_started_at ? new Date(match.last_started_at).getTime() : now;
  const delta = Math.max(0, Math.floor((now - last) / 1000));
  return patchMatch(match.id, {
    is_running: false,
    last_started_at: null,
    elapsed_seconds: (match.elapsed_seconds || 0) + delta,
  });
}

export async function resetClock(matchId, duration = 600) {
  return patchMatch(matchId, {
    status: "scheduled",
    duration_seconds: duration,
    elapsed_seconds: 0,
    is_running: false,
    last_started_at: null,
  });
}

export async function finishMatch(match) {
  const paused = await pauseClock(match);
  return patchMatch(paused.id, { status: "finished" });
}

// ---- QUICK SCORE (+ / -)
export async function quickPlusGoal(matchId, teamId) {
  const { data, error } = await supabase
    .from("goals")
    .insert({ match_id: matchId, team_id: teamId, player_id: null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function quickMinusGoal(matchId, teamId) {
  const { data, error } = await supabase
    .from("goals")
    .select("id")
    .eq("match_id", matchId)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data?.length) return false;
  const del = await supabase.from("goals").delete().eq("id", data[0].id);
  if (del.error) throw del.error;
  return true;
}

// Sport name s tolerantnim fallbackom (406 = nema reda)
export async function getSportNameSafe(sportId) {
  try {
    const { data, error, status } = await supabase
      .from("sports")
      .select("name")
      .eq("id", sportId)
      .single();

    if (error) {
      if (status === 406) return `Sport #${sportId}`;
      throw error;
    }
    return data?.name || `Sport #${sportId}`;
  } catch {
    return `Sport #${sportId}`;
  }
}

// Rezultati (s imenima timova preko FK)
export async function getResultsBySport(sportId) {
  const { data, error } = await supabase
    .from("matches")
    .select(`
      id, sport_id, round, group_label, start_time, score_a, score_b,
      team_a:team_a_id ( id, name ),
      team_b:team_b_id ( id, name )
    `)
    .eq("sport_id", sportId)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data;
}
