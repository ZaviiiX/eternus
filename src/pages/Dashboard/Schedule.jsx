import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getTeamsBySport,
  createMatchesBulk,
  supabase,
} from "../../services/api";
import {
  computeBestGrouping,
  materializeGroups,
  buildInterleavedSchedule,
} from "../../utils/drawFootball";
import {
  CalendarClock,
  Trash2,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Calendar,
  Clock,
  Zap,
  Filter,
  ChevronRight,
  Trophy,
  Target,
  Sparkles,
  RefreshCw
} from "lucide-react";

export default function Schedule() {
  const { profile, loading } = useAuth();
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [smartBusy, setSmartBusy] = useState(false);
  const [smartStart, setSmartStart] = useState("");
  const [smartSpacing, setSmartSpacing] = useState(20);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all"); // all, live, upcoming, finished

  // ---- DATA ----
  const loadAll = async () => {
    if (!profile?.sport_id) return;
    try {
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase
          .from("teams")
          .select("id,name")
          .eq("sport_id", profile.sport_id)
          .order("name"),
        supabase
          .from("matches")
          .select(
            "id,round,group_label,team_a_id,team_b_id,score_a,score_b,start_time,is_running,status"
          )
          .eq("sport_id", profile.sport_id)
          .order("start_time", { ascending: true }),
      ]);

      setTeams(t || []);
      setMatches(
        (m || []).sort(
          (a, b) => new Date(a.start_time) - new Date(b.start_time)
        )
      );
    } catch (e) {
      console.error("loadAll error:", e);
    }
  };

  useEffect(() => {
    if (!loading) loadAll();
  }, [loading, profile?.sport_id]);

  useEffect(() => {
    if (!profile?.sport_id) return;
    const ch = supabase
      .channel("matches_rt_schedule")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `sport_id=eq.${profile.sport_id}`,
        },
        () => loadAll()
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile?.sport_id]);

  // ---- SMART DRAW ----
  const generateSmartGroupsFootball = async () => {
    if (!profile?.sport_id) return;
    const sportId = profile.sport_id;
    const teamIds = teams.map((t) => t.id);

    if (teamIds.length < 3) {
      alert("Potrebno je barem 3 ekipe za grupnu fazu.");
      return;
    }

    const grouping = computeBestGrouping(teamIds.length);
    const groups = materializeGroups(teamIds, grouping);
    const ordered = buildInterleavedSchedule(groups);

    let current = smartStart ? new Date(smartStart) : null;
    const payload = ordered.map((m) => {
      const row = {
        sport_id: sportId,
        team_a_id: m.team_a_id,
        team_b_id: m.team_b_id,
        group_label: m.group_label,
        round: m.round_label,
        start_time: current ? new Date(current).toISOString() : null,
      };
      if (current)
        current.setMinutes(current.getMinutes() + Number(smartSpacing || 20));
      return row;
    });

    if (!payload.length) {
      alert("Nije generirano nijedno kolo (provjeri broj ekipa).");
      return;
    }

    setSmartBusy(true);
    try {
      await createMatchesBulk(payload);
      await loadAll();
      setShowModal(false);
    } catch (e) {
      console.error("generateSmartGroupsFootball error:", e);
      alert(e?.message || "Greška pri generiranju ždrijeba.");
    } finally {
      setSmartBusy(false);
    }
  };

  // ---- DELETE ----
  const deleteSchedule = async () => {
    if (!profile?.sport_id) return;
    try {
      await supabase.from("matches").delete().eq("sport_id", profile.sport_id);
      await loadAll();
      setConfirmDelete(false);
    } catch (error) {
      console.error("Error deleting schedule:", error);
      alert("Greška pri brisanju rasporeda.");
    }
  };

  if (loading) return null;
  if (!profile?.sport_id) return <p className="p-6">Nemate pridružen sport.</p>;

  // ---- FILTER ----
  const filteredMatches = useMemo(() => {
    if (filterStatus === "all") return matches;
    if (filterStatus === "live") return matches.filter(m => m.status === "live");
    if (filterStatus === "upcoming") return matches.filter(m => m.status !== "live" && m.status !== "finished");
    if (filterStatus === "finished") return matches.filter(m => m.status === "finished");
    return matches;
  }, [matches, filterStatus]);

  // ---- GROUP BY DATE ----
  const matchesByDate = useMemo(() => {
    const map = {};
    for (const m of filteredMatches) {
      const k = m.start_time
        ? new Date(m.start_time).toLocaleDateString("hr-HR", {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          })
        : "Bez datuma";
      if (!map[k]) map[k] = [];
      map[k].push(m);
    }
    return map;
  }, [filteredMatches]);

  const anyLiveOrPaused = matches.some((m) => m.status === "live");

  // Stats
  const stats = {
    total: matches.length,
    live: matches.filter(m => m.status === "live").length,
    upcoming: matches.filter(m => m.status !== "live" && m.status !== "finished").length,
    finished: matches.filter(m => m.status === "finished").length
  };

  const statusBadge = (m) => {
    if (m.status === "finished") {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400 text-xs font-bold">Završeno</span>
        </div>
      );
    }
    if (m.status === "live" && !m.is_running) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40">
          <Pause className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-amber-300 text-xs font-bold">Pauza</span>
        </div>
      );
    }
    if (m.is_running) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-red-400 text-xs font-bold">LIVE</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40">
        <Clock className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-blue-400 text-xs font-bold">Nadolazi</span>
      </div>
    );
  };

  const timePill = (m) => {
    const label = m.start_time
      ? new Date(m.start_time).toLocaleTimeString("hr-HR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "–";
    let cls = "bg-[#1F1F23] text-[#A1A1AA] border-[#2C2C2F]";
    if (m.status === "finished") cls = "bg-green-500/10 text-green-300 border-green-500/20";
    else if (m.status === "live" && !m.is_running)
      cls = "bg-amber-500/10 text-amber-300 border-amber-500/20";
    else if (m.is_running) cls = "bg-red-500/10 text-red-300 border-red-500/20";
    else cls = "bg-blue-500/10 text-blue-300 border-blue-500/20";
    
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-sm font-bold ${cls}`}>
        <Clock className="w-3.5 h-3.5" />
        {label}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center">
                <CalendarClock className="w-7 h-7 text-white" />
              </div>
              Raspored utakmica
            </h1>
            <p className="text-[#A1A1AA]">Pregled i upravljanje rasporedom natjecanja</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => loadAll()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#18181B] border-2 border-[#2C2C2F] hover:border-[#00E0FF] text-white font-semibold transition-all hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
              Osvježi
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] text-black font-bold px-6 py-3 rounded-xl hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] transition-all duration-300 hover:scale-105"
            >
              <Brain className="w-5 h-5" />
              Pametni ždrijeb
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-[#00E0FF]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#00E0FF]/20">
                <Calendar className="w-5 h-5 text-[#00E0FF]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Ukupno</span>
            </div>
            <p className="text-3xl font-black">{stats.total}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-red-500/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-red-500/20">
                <Play className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Live</span>
            </div>
            <p className="text-3xl font-black text-red-400">{stats.live}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-blue-500/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Nadolazi</span>
            </div>
            <p className="text-3xl font-black text-blue-400">{stats.upcoming}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-green-500/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Trophy className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Završeno</span>
            </div>
            <p className="text-3xl font-black text-green-400">{stats.finished}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {[
          { id: "all", label: "Sve", icon: Calendar, count: stats.total },
          { id: "live", label: "Live", icon: Play, count: stats.live, color: "red" },
          { id: "upcoming", label: "Nadolazi", icon: Clock, count: stats.upcoming, color: "blue" },
          { id: "finished", label: "Završeno", icon: Trophy, count: stats.finished, color: "green" }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = filterStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all whitespace-nowrap ${
                isActive
                  ? "bg-gradient-to-r from-[#00E0FF] to-[#7C3AED] text-white shadow-lg scale-105"
                  : "bg-[#18181B] text-[#A1A1AA] hover:bg-[#2C2C2F] border border-[#2C2C2F]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                isActive ? "bg-white/20" : "bg-[#2C2C2F]"
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* --- LISTA PO DANIMA --- */}
      {Object.keys(matchesByDate).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(matchesByDate).map(([date, games]) => (
            <div
              key={date}
              className="bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl shadow-xl border border-[#2C2C2F] overflow-hidden"
            >
              <div className="p-5 border-b border-[#2C2C2F] bg-gradient-to-r from-[#00E0FF]/5 to-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00E0FF]/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-[#00E0FF]" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-lg capitalize">{date}</h3>
                      <p className="text-xs text-[#666]">{games.length} utakmica</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-[#2C2C2F]">
                {games.map((m) => {
                  const teamA = teams.find((t) => t.id === m.team_a_id)?.name || "-";
                  const teamB = teams.find((t) => t.id === m.team_b_id)?.name || "-";
                  const hasScore = Number.isFinite(m.score_a) && Number.isFinite(m.score_b);
                  const isFinished = m.status === "finished";
                  const isActive = m.status === "live";
                  const isRunning = !!m.is_running;

                  return (
                    <div
                      key={m.id}
                      className="p-5 hover:bg-[#0D1117] transition-all duration-300 group"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Lijevo - Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="px-3 py-1 rounded-lg bg-[#2C2C2F] text-xs font-bold text-[#00E0FF]">
                              {m.round || "Kolo"}
                            </div>
                            {m.group_label && (
                              <div className="px-3 py-1 rounded-lg bg-[#7C3AED]/20 text-xs font-bold text-[#7C3AED]">
                                {m.group_label}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <p className="text-white font-bold text-lg">{teamA}</p>
                            <div className="px-3 py-1 rounded-lg bg-[#00E0FF]/20">
                              <span className="text-[#00E0FF] font-black text-sm">VS</span>
                            </div>
                            <p className="text-white font-bold text-lg">{teamB}</p>
                          </div>
                        </div>

                        {/* Desno - Status i akcije */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Vrijeme */}
                          {timePill(m)}

                          {/* Rezultat */}
                          {hasScore && (
                            <div className="px-4 py-2 rounded-lg bg-[#00E0FF]/20 border border-[#00E0FF]/40">
                              <p className="text-[#00E0FF] font-black text-xl font-mono">
                                {m.score_a} - {m.score_b}
                              </p>
                            </div>
                          )}

                          {/* Status */}
                          {statusBadge(m)}

                          {/* Akcije */}
                          {anyLiveOrPaused ? (
                            isActive ? (
                              <Link
                                to={`/active-match/${m.id}`}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all hover:scale-105 ${
                                  isRunning
                                    ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30"
                                    : "bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-lg shadow-amber-500/30"
                                }`}
                              >
                                {isRunning ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                Otvori
                              </Link>
                            ) : null
                          ) : !isFinished ? (
                            <Link
                              to={`/dashboard/match/${m.id}`}
                              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2C2C2F] border border-[#00E0FF]/40 text-[#00E0FF] font-semibold hover:bg-[#00E0FF]/10 transition-all group-hover:scale-105"
                            >
                              Upravljaj
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-[#00E0FF]/10 flex items-center justify-center mx-auto mb-6">
            <Calendar className="w-10 h-10 text-[#00E0FF]" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            {filterStatus === "all" ? "Nema utakmica u rasporedu" : `Nema ${filterStatus === "live" ? "live" : filterStatus === "upcoming" ? "nadolazećih" : "završenih"} utakmica`}
          </h3>
          <p className="text-[#A1A1AA] mb-6">
            {filterStatus === "all" ? "Generirajte raspored pomoću pametnog ždrijeba" : "Promijenite filter za pregled drugih utakmica"}
          </p>
          {filterStatus === "all" && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] text-black font-bold px-6 py-3 rounded-xl hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] transition-all duration-300 hover:scale-105"
            >
              <Brain className="w-5 h-5" />
              Generiraj raspored
            </button>
          )}
        </div>
      )}

      {/* --- DELETE RASPORED --- */}
      {matches.length > 0 && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-semibold hover:underline transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Obriši cijeli raspored
          </button>
        </div>
      )}

      {/* --- MODAL ZA GENERIRANJE --- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#00E0FF]/20 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-[#2C2C2F] bg-gradient-to-r from-[#00E0FF]/5 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Pametni ždrijeb</h2>
                  <p className="text-xs text-[#666]">AI-powered raspored generator</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-start gap-3 p-4 bg-[#00E0FF]/5 border border-[#00E0FF]/20 rounded-xl">
                <Sparkles className="w-5 h-5 text-[#00E0FF] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#A1A1AA]">
                  Sustav automatski formira optimalne grupe i raspored. Možete definirati početno vrijeme i razmak između utakmica.
                </p>
              </div>

              <div>
                <label className="flex text-sm font-bold text-white mb-2 items-center gap-2">
                  <Clock className="w-4 h-4 text-[#00E0FF]" />
                  Početno vrijeme (opcionalno)
                </label>
                <input
                  type="datetime-local"
                  className="bg-[#0D1117] border-2 border-[#2C2C2F] text-white p-3 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-[#00E0FF] focus:border-[#00E0FF] transition-all"
                  value={smartStart}
                  onChange={(e) => setSmartStart(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#00E0FF]" />
                  Razmak između utakmica (minute)
                </label>
                <input
                  type="number"
                  min={5}
                  className="bg-[#0D1117] border-2 border-[#2C2C2F] text-white p-3 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-[#00E0FF] focus:border-[#00E0FF] transition-all"
                  value={smartSpacing}
                  onChange={(e) => setSmartSpacing(Number(e.target.value))}
                />
                <p className="text-xs text-[#666] mt-2">Preporučeno: 15-30 minuta</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#2C2C2F]">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 rounded-xl bg-[#2C2C2F] text-white hover:bg-[#3A3A3E] transition-all font-semibold"
                >
                  Odustani
                </button>
                <button
                  onClick={generateSmartGroupsFootball}
                  disabled={smartBusy}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] text-black font-bold hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 hover:scale-105"
                >
                  {smartBusy ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      Generiram...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Generiraj raspored
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-red-500/20 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-4 rounded-xl bg-red-500/20">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white mb-1">Obriši raspored?</h2>
                <p className="text-xs text-[#666]">Ova akcija je trajna</p>
              </div>
            </div>

            <p className="text-[#A1A1AA] mb-6 pl-16">
              Ova radnja će trajno obrisati sve utakmice iz rasporeda. Svi rezultati i statistike bit će izgubljeni.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-6 py-3 rounded-xl bg-[#2C2C2F] text-white hover:bg-[#3A3A3E] transition-all font-semibold"
              >
                Odustani
              </button>
              <button
                onClick={deleteSchedule}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 font-bold transition-all hover:scale-105"
              >
                Potvrdi brisanje
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}