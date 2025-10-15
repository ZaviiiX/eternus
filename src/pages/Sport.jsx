import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../services/api";
import { 
  Trophy, 
  Users, 
  CalendarClock, 
  Flame, 
  Filter, 
  CircleDot, 
  X,
  Clock,
  ArrowLeft,
  Target,
  Award,
  Zap,
  ChevronRight,
  Play,
  Pause,
  CheckCircle2
} from "lucide-react";

/* ======================
   ⏱ Helperi za timer
====================== */
function computeElapsedSeconds(match) {
  let elapsed = Number(match.elapsed_seconds ?? 0);
  if (match.is_running && match.last_started_at) {
    const delta = Math.floor((Date.now() - new Date(match.last_started_at).getTime()) / 1000);
    elapsed += delta;
  }
  return Math.max(0, elapsed);
}
function computeRemainingSeconds(match) {
  const duration = Number(match.duration_seconds ?? 600);
  return Math.max(0, duration - computeElapsedSeconds(match));
}
function mmss(sec) {
  const s = Math.max(0, sec | 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/* ======================
   🧩 Modal utility
====================== */
function useModalControls(isOpen, onClose) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => dialogRef.current?.focus(), 0);
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };
  return { dialogRef, onBackdrop };
}

/* ======================
   🏆 Komponenta
====================== */
export default function Sport() {
  const { id } = useParams();
  const sportId = Number(id);

  const [sportName, setSportName] = useState("");
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [teamMatches, setTeamMatches] = useState([]);
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState("all");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  async function loadAll() {
    try {
      const { data: sportData } = await supabase
        .from("sports")
        .select("name")
        .eq("id", sportId)
        .maybeSingle();
      setSportName(sportData?.name || `Sport #${sportId}`);

      const { data: teamList } = await supabase
        .from("teams")
        .select("id,name")
        .eq("sport_id", sportId)
        .order("name");
      setTeams(teamList || []);

      const { data: ms } = await supabase
        .from("matches")
        .select(`
          id, sport_id, round, group_label, start_time,
          score_a, score_b,
          is_running, status, duration_seconds, elapsed_seconds, last_started_at,
          team_a:team_a_id ( name ),
          team_b:team_b_id ( name )
        `)
        .eq("sport_id", sportId)
        .order("start_time", { ascending: true });

      const norm = (ms || []).map((m) => ({
        ...m,
        team_a_name: m.team_a?.name || "-",
        team_b_name: m.team_b?.name || "-",
        is_running: !!m.is_running,
        status: m.status === "finished" ? "finished" : (m.status === "live" ? "live" : "scheduled"),
        duration_seconds: Number(m.duration_seconds ?? 600),
        elapsed_seconds: Number(m.elapsed_seconds ?? 0),
        last_started_at: m.last_started_at || null,
      }));
      setMatches(norm);
    } catch (e) {
      console.error("loadAll error:", e);
    }
  }
  useEffect(() => { loadAll(); }, [sportId]);

  useEffect(() => {
    const ch = supabase
      .channel(`sport_${sportId}_matches_rt`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `sport_id=eq.${sportId}` },
        () => loadAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        () => { if (selectedTeam) loadTeamDetails(selectedTeam.id); }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sportId, selectedTeam?.id]);

  async function loadTeamDetails(teamId) {
    try {
      const { data: players } = await supabase
        .from("players")
        .select("id, first_name, last_name")
        .eq("team_id", teamId)
        .order("last_name");
      setTeamPlayers(players || []);

      const { data: ms } = await supabase
        .from("matches")
        .select(`
          id, team_a_id, team_b_id, score_a, score_b, start_time,
          is_running, status, duration_seconds, elapsed_seconds, last_started_at,
          teams_a:team_a_id ( name ),
          teams_b:team_b_id ( name )
        `)
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .order("start_time", { ascending: false });

      const norm = (ms || []).map((m) => ({
        ...m,
        is_running: !!m.is_running,
        status: m.status === "finished" ? "finished" : (m.status === "live" ? "live" : "scheduled"),
      }));
      setTeamMatches(norm);
    } catch (e) {
      console.error("loadTeamDetails error:", e);
    }
  }

  function StatusCell({ m }) {
    if (m.status === "live" && !m.is_running) {
      const remaining = computeRemainingSeconds(m);
      return (
        <div className="flex items-center gap-2 justify-end">
          <Pause className="w-3 h-3 text-amber-300" />
          <span className="text-amber-300 font-semibold text-xs">
            PAUZA • {mmss(remaining)}
          </span>
        </div>
      );
    }
    if (m.is_running) {
      const remaining = computeRemainingSeconds(m);
      const played = m.duration_seconds - remaining;
      const pct = Math.min(100, Math.max(0, (played / m.duration_seconds) * 100));
      return (
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 text-red-400 font-semibold text-xs">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {mmss(remaining)}
          </span>
          <div className="w-28 h-1 bg-[#2B0000] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    }
    if (m.status === "finished") {
      return (
        <div className="flex items-center gap-2 justify-end">
          <CheckCircle2 className="w-3 h-3 text-green-400" />
          <span className="text-green-400 font-semibold text-xs">Završeno</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 justify-end">
        <Clock className="w-3 h-3 text-blue-400" />
        <span className="text-blue-400 font-semibold text-xs">Nadolazi</span>
      </div>
    );
  }

  const filteredMatches = useMemo(() => {
    if (filter === "live") return matches.filter((m) => m.status === "live");
    if (filter === "upcoming") return matches.filter((m) => m.status === "scheduled");
    if (filter === "finished") return matches.filter((m) => m.status === "finished");
    return matches;
  }, [matches, filter, tick]);

  const liveNow = matches.filter((m) => m.status === "live");

  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const m of filteredMatches) {
      const k = m.start_time ? new Date(m.start_time).toLocaleDateString("hr-HR", {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }) : "Bez datuma";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(m);
    }
    return map;
  }, [filteredMatches]);

  const { dialogRef, onBackdrop } = useModalControls(!!selectedTeam, () => setSelectedTeam(null));

  const stats = {
    total: matches.length,
    live: liveNow.length,
    upcoming: matches.filter(m => m.status === "scheduled").length,
    finished: matches.filter(m => m.status === "finished").length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27] text-white">
      {/* Header */}
      <div className="bg-[#18181B]/80 backdrop-blur-xl border-b border-[#2C2C2F] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="p-2 hover:bg-[#2C2C2F] rounded-lg transition-colors group">
                <ArrowLeft className="w-5 h-5 text-[#A1A1AA] group-hover:text-white group-hover:-translate-x-1 transition-all" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-[#00E0FF]/50">
                  <Trophy className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">{sportName}</h1>
                  <p className="text-xs text-[#A1A1AA]">{teams.length} ekipa • {matches.length} utakmica</p>
                </div>
              </div>
            </div>

            {stats.live > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-full animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm font-bold text-red-400">{stats.live} LIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-[#00E0FF]/40 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#00E0FF]/20">
                <Target className="w-5 h-5 text-[#00E0FF]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Ukupno</span>
            </div>
            <p className="text-3xl font-black">{stats.total}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-red-500/40 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Play className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Live</span>
            </div>
            <p className="text-3xl font-black text-red-400">{stats.live}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-blue-500/40 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Nadolazi</span>
            </div>
            <p className="text-3xl font-black text-blue-400">{stats.upcoming}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-green-500/40 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Award className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Završeno</span>
            </div>
            <p className="text-3xl font-black text-green-400">{stats.finished}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-[#A1A1AA]" />
          <div className="flex gap-2">
            {[
              { key: "all", label: "Sve", count: stats.total },
              { key: "live", label: "Live", count: stats.live },
              { key: "upcoming", label: "Nadolazi", count: stats.upcoming },
              { key: "finished", label: "Završeno", count: stats.finished },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  filter === f.key
                    ? "bg-gradient-to-r from-[#00E0FF] to-[#7C3AED] text-white shadow-lg scale-105"
                    : "bg-[#18181B] text-[#A1A1AA] hover:bg-[#2C2C2F] border border-[#2C2C2F]"
                }`}
              >
                {f.label}
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  filter === f.key ? "bg-white/20" : "bg-[#2C2C2F]"
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* LIVE SADA */}
        {liveNow.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-xl font-bold">Live sada</h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {liveNow.map((m) => {
                const remaining = computeRemainingSeconds(m);
                const played = m.duration_seconds - remaining;
                const pct = Math.min(100, Math.max(0, (played / m.duration_seconds) * 100));
                const paused = m.status === "live" && !m.is_running;

                return (
                  <Link
                    key={m.id}
                    to={`/active-match/${m.id}`}
                    className="group relative overflow-hidden bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#00E0FF]/40 rounded-2xl p-6 hover:border-[#00E0FF] hover:scale-[1.02] transition-all shadow-lg shadow-[#00E0FF]/20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00E0FF]/5 to-transparent" />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                          paused ? "bg-amber-500/20 border border-amber-500/40" : "bg-red-500/20 border border-red-500/40"
                        }`}>
                          {paused ? <Pause className="w-3 h-3 text-amber-300" /> : <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                          <span className={`text-xs font-bold ${paused ? "text-amber-300" : "text-red-400"}`}>
                            {paused ? "PAUZA" : "LIVE"}
                          </span>
                        </div>
                        <span className="text-sm font-mono font-bold text-[#00E0FF]">{mmss(remaining)}</span>
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <span className="text-white font-bold text-lg">{m.team_a_name}</span>
                        <div className="text-4xl font-black text-[#00E0FF]">
                          {Number.isFinite(m.score_a) ? m.score_a : 0} : {Number.isFinite(m.score_b) ? m.score_b : 0}
                        </div>
                        <span className="text-white font-bold text-lg">{m.team_b_name}</span>
                      </div>

                      <div className="w-full h-2 bg-[#2B0000] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${paused ? "bg-amber-400" : "bg-gradient-to-r from-red-500 to-orange-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* EKIPE */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-6 h-6 text-[#00E0FF]" />
            <h2 className="text-xl font-bold">Ekipe</h2>
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {teams.map((team) => {
              const active = selectedTeam?.id === team.id;
              return (
                <button
                  key={team.id}
                  onClick={async () => {
                    setSelectedTeam(team);
                    await loadTeamDetails(team.id);
                  }}
                  className={`group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ${
                    active 
                      ? "bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] shadow-lg shadow-[#00E0FF]/30 scale-105" 
                      : "bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] hover:border-[#00E0FF]/60 hover:scale-105"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold truncate ${active ? "text-white" : "text-white"}`}>
                      {team.name}
                    </span>
                    <ChevronRight className={`w-4 h-4 transition-all ${
                      active ? "text-white translate-x-0" : "text-[#666] -translate-x-2 group-hover:translate-x-0 group-hover:text-[#00E0FF]"
                    }`} />
                  </div>
                </button>
              );
            })}
            {teams.length === 0 && (
              <p className="text-[#A1A1AA] text-sm col-span-full">Nema dostupnih ekipa.</p>
            )}
          </div>
        </section>

        {/* RASPORED I REZULTATI */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-6 h-6 text-[#00E0FF]" />
            <h2 className="text-xl font-bold">Raspored i rezultati</h2>
          </div>

          <div className="space-y-6">
            {[...groupedByDate.entries()].map(([dateLabel, list]) => (
              <div key={dateLabel} className="bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl border border-[#2C2C2F] overflow-hidden shadow-xl">
                <div className="px-6 py-4 bg-gradient-to-r from-[#00E0FF]/5 to-transparent border-b border-[#2C2C2F]">
                  <h3 className="font-bold capitalize">{dateLabel}</h3>
                  <p className="text-xs text-[#666]">{list.length} utakmica</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#0D1117] border-b border-[#2C2C2F]">
                      <tr>
                        <th className="p-4 text-left text-xs font-bold text-[#A1A1AA] uppercase">Kolo / Grupa</th>
                        <th className="p-4 text-left text-xs font-bold text-[#A1A1AA] uppercase">Utakmica</th>
                        <th className="p-4 text-left text-xs font-bold text-[#A1A1AA] uppercase">Vrijeme</th>
                        <th className="p-4 text-right text-xs font-bold text-[#A1A1AA] uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2C2C2F]">
                      {list.map((m) => (
                        <tr
                          key={m.id}
                          className={`hover:bg-[#0D1117] transition-colors ${
                            m.status === "live" ? "bg-[#00E0FF]/5" : ""
                          }`}
                        >
                          <td className="p-4 text-[#A1A1AA]">
                            <div>
                              {m.round || "-"}
                              {m.group_label && (
                                <span className="ml-2 px-2 py-0.5 text-xs bg-[#2C2C2F] rounded">
                                  {m.group_label}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <Link
                              to={m.status === "finished" ? `/dashboard/match/${m.id}` : `/active-match/${m.id}`}
                              className="text-white hover:text-[#00E0FF] transition-colors font-semibold"
                            >
                              {m.team_a_name} <span className="text-[#00E0FF]">VS</span> {m.team_b_name}
                            </Link>
                          </td>
                          <td className="p-4 text-[#A1A1AA]">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {m.start_time ? new Date(m.start_time).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            {Number.isFinite(m.score_a) && Number.isFinite(m.score_b) ? (
                              <span className={`text-xl font-black ${m.status === "finished" ? "text-[#00E0FF]" : "text-white"}`}>
                                {m.score_a} - {m.score_b}
                              </span>
                            ) : (
                              <StatusCell m={m} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {filteredMatches.length === 0 && (
              <div className="text-center py-16 bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl border border-[#2C2C2F]">
                <CalendarClock size={48} className="mx-auto mb-4 text-[#A1A1AA]" />
                <p className="text-[#A1A1AA] text-lg">Nema dostupnih utakmica.</p>
              </div>
            )}
          </div>
        </section>

        {/* MODAL: Detalji ekipe */}
        {selectedTeam && (
          <div
            onMouseDown={onBackdrop}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              ref={dialogRef}
              tabIndex={-1}
              className="w-full max-w-4xl bg-gradient-to-br from-[#18181B] to-[#0D1117] border-2 border-[#00E0FF]/20 rounded-2xl shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-[#2C2C2F] bg-gradient-to-r from-[#00E0FF]/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">{selectedTeam.name}</h3>
                    <p className="text-xs text-[#666]">{teamPlayers.length} igrača • {teamMatches.length} utakmica</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="p-2 rounded-lg hover:bg-[#2C2C2F] transition-colors"
                >
                  <X className="w-6 h-6 text-[#A1A1AA] hover:text-white" />
                </button>
              </div>

              {/* Body */}
              <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-8">
                {/* Igrači */}
                <section>
                  <h4 className="text-sm font-bold text-[#00E0FF] uppercase mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Igrači
                  </h4>
                  {teamPlayers.length ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {teamPlayers.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3 bg-[#0D1117] border border-[#2C2C2F] rounded-xl p-3 hover:border-[#00E0FF]/40 transition-all">
                          <div className="w-8 h-8 rounded-lg bg-[#00E0FF]/20 flex items-center justify-center text-[#00E0FF] font-bold text-sm">
                            {i + 1}
                          </div>
                          <span className="text-white text-sm font-semibold truncate">
                            {p.first_name} {p.last_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[#A1A1AA] text-sm">Nema dostupnih igrača.</p>
                  )}
                </section>

                {/* Utakmice */}
                <section>
                  <h4 className="text-sm font-bold text-[#00E0FF] uppercase mb-4 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Utakmice ekipe
                  </h4>
                  {teamMatches.length ? (
                    <div className="overflow-hidden rounded-xl border border-[#2C2C2F]">
                      <table className="w-full">
                        <thead className="bg-[#0D1117] border-b border-[#2C2C2F]">
                          <tr>
                            <th className="p-3 text-left text-xs font-bold text-[#A1A1AA] uppercase">Protivnik</th>
                            <th className="p-3 text-left text-xs font-bold text-[#A1A1AA] uppercase">Vrijeme</th>
                            <th className="p-3 text-right text-xs font-bold text-[#A1A1AA] uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2C2C2F]">
                          {teamMatches.map((m) => {
                            const isTeamA = m.team_a_id === selectedTeam.id;
                            const opponent = isTeamA ? (m.teams_b?.name || "Nepoznat") : (m.teams_a?.name || "Nepoznat");
                            const isFinished = m.status === "finished";
                            return (
                              <tr key={m.id} className="hover:bg-[#0D1117] transition-colors">
                                <td className="p-3 text-white font-semibold">{opponent}</td>
                                <td className="p-3 text-[#A1A1AA] text-sm">
                                  {m.start_time ? new Date(m.start_time).toLocaleString("hr-HR", {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : "-"}
                                </td>
                                <td className="p-3 text-right">
                                  {Number.isFinite(m.score_a) && Number.isFinite(m.score_b) ? (
                                    <span className={`text-lg font-black ${isFinished ? "text-[#00E0FF]" : "text-white"}`}>
                                      {m.score_a} - {m.score_b}
                                    </span>
                                  ) : (
                                    <StatusCell m={m} />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[#A1A1AA] text-sm">Nema utakmica.</p>
                  )}
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[#2C2C2F] flex justify-end">
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="px-6 py-3 bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] text-black font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] transition-all hover:scale-105"
                >
                  Zatvori
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}