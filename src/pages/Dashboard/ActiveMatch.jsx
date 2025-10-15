// src/pages/Dashboard/ActiveMatch.jsx
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  supabase,
  getMatchById,
  getTeamsByIds,
  getPlayersByTeam,
  getGoalsByMatch,
  addGoal,
  undoLastGoal,
  startClock,
  pauseClock,
  resetClock,
  finishMatch,
  quickPlusGoal,
  quickMinusGoal,
} from "../../services/api";
import {
  Play,
  Pause,
  RotateCcw,
  Flag,
  ArrowLeft,
  Minus,
  Clock as ClockIcon,
  Trophy,
  Undo2,
  Plus,
  Zap,
  Target,
  AlertCircle,
  CheckCircle2,
  Users,
  TrendingUp,
  Award,
  Radio
} from "lucide-react";

function formatMMSS(sec) {
  const s = Math.max(0, sec | 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function computeRemaining(m) {
  if (!m) return 0;
  const duration = Number(m.duration_seconds ?? 600);
  const baseElapsed = Number(m.elapsed_seconds ?? 0);

  let elapsed = baseElapsed;
  if (m.is_running && m.last_started_at) {
    const delta = Math.floor(
      (Date.now() - new Date(m.last_started_at).getTime()) / 1000
    );
    elapsed += delta;
  }
  return Math.max(0, duration - elapsed);
}

export default function ActiveMatch() {
  const { id } = useParams();
  const matchId = Number(id);
  const { loading, profile } = useAuth();

  const canManage = Boolean(
    profile?.role === "admin" ||
      profile?.role === "sport_admin" ||
      profile?.sport_id
  );

  const [match, setMatch] = useState(null);
  const [teams, setTeams] = useState({});
  const [players, setPlayers] = useState({});
  const [goals, setGoals] = useState([]);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [toast, setToast] = useState(null);

  const timerRef = useRef(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadMatchData = useCallback(async () => {
    try {
      const m = await getMatchById(matchId);

      try {
        const { data: clockData, error: clockErr } = await supabase
          .from("matches")
          .select(
            "is_running,duration_seconds,elapsed_seconds,last_started_at,status,score_a,score_b,finished_at"
          )
          .eq("id", matchId)
          .single();
        if (!clockErr && clockData) Object.assign(m, clockData);
      } catch {}

      let elapsed = Number(m.elapsed_seconds || 0);
      if (m.last_started_at) {
        const delta = Math.floor(
          (Date.now() - new Date(m.last_started_at)) / 1000
        );
        elapsed += delta;
      }
      m.elapsed_seconds = elapsed;

      m.is_running = Boolean(m.is_running);
      m.status = m.finished_at
        ? "finished"
        : m.status === "live"
        ? "live"
        : m.is_running
        ? "live"
        : "scheduled";

      const [teamList, goalsData] = await Promise.all([
        getTeamsByIds([m.team_a_id, m.team_b_id]),
        getGoalsByMatch(matchId),
      ]);

      const [playersA, playersB] = await Promise.all([
        getPlayersByTeam(teamList[0].id),
        getPlayersByTeam(teamList[1].id),
      ]);

      setMatch(m);
      setTeams({ A: teamList[0], B: teamList[1] });
      setPlayers({ A: playersA, B: playersB });
      setGoals(goalsData);

      clearInterval(timerRef.current);
      const rem = computeRemaining(m);
      setLiveSeconds(rem);
      if (m.is_running) {
        timerRef.current = setInterval(() => {
          setLiveSeconds((s) => Math.max(0, s - 1));
        }, 1000);
      }
    } catch (e) {
      console.error("loadMatchData error:", e);
      setMatch(null);
    }
  }, [matchId]);

  useEffect(() => {
    if (!loading && matchId) loadMatchData();
  }, [loading, matchId, loadMatchData]);

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase
      .channel(`match_${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `match_id=eq.${matchId}`,
        },
        () => getGoalsByMatch(matchId).then(setGoals)
      )
      .on(
        "postgres_changes",
        {
          event: "update",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        () => loadMatchData()
      )
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [matchId, loadMatchData]);

  useEffect(() => {
    if (!match) return;
    setLiveSeconds(computeRemaining(match));
    clearInterval(timerRef.current);
    if (match.is_running) {
      timerRef.current = setInterval(() => {
        setLiveSeconds((s) => Math.max(0, s - 1));
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [match]);

  useEffect(() => {
    if (!match || !match.is_running) return;
    if (liveSeconds > 0) return;

    const startedAt = match.last_started_at
      ? new Date(match.last_started_at).getTime()
      : 0;
    const ageMs = Date.now() - startedAt;
    if (ageMs < 1500) return;

    (async () => {
      const paused = await pauseClock(match);
      setMatch(await finishMatch(paused));
      showToast("Utakmica automatski završena!", "success");
    })();
  }, [match, liveSeconds]);

  const playerGoals = useMemo(() => {
    const counts = new Map();
    goals.forEach((g) => g.player_id && counts.set(g.player_id, (counts.get(g.player_id) || 0) + 1));
    return counts;
  }, [goals]);

  const guard = () => {
    if (!canManage) return true;
    return false;
  };

  const handleStart = async () => {
    if (guard()) return;
    if (match.status === "finished" || match.finished_at) {
      return showToast("Ovaj meč je već završen!", "error");
    }
    try {
      const { data: active } = await supabase
        .from("matches")
        .select("id")
        .eq("sport_id", match.sport_id)
        .eq("is_running", true)
        .limit(1);
      if (active?.length && active[0].id !== match.id) {
        return showToast("Samo jedna utakmica može biti aktivna!", "error");
      }
    } catch (e) {
      console.warn("Could not verify other running matches before starting:", e);
    }
    setMatch((prev) => ({
      ...(prev || {}),
      is_running: true,
      last_started_at: new Date().toISOString(),
      status: "live",
    }));
    try {
      await startClock(match);
      showToast("Utakmica pokrenuta!", "success");
    } catch (e) {
      console.error("startClock error:", e);
    }
    await loadMatchData();
  };

  const handlePause = async () => {
    if (guard()) return;
    setMatch(await pauseClock(match));
    showToast("Utakmica pauzirana", "info");
  };

  const handleReset = async () => {
    if (guard()) return;
    if (match.status === "finished" || match.finished_at) {
      return showToast("Ne možete resetirati završeni meč", "error");
    }
    const r = await resetClock(match.id, match.duration_seconds || 600);
    setMatch(r);
    setLiveSeconds(Number(r.duration_seconds || 600));
    showToast("Timer resetiran", "info");
  };

  const handleFinish = async () => {
    if (guard()) return;
    setMatch(await finishMatch(match));
    showToast("Utakmica završena!", "success");
  };

  const handleAddGoal = async (key, p) => {
    if (guard()) return;
    if (match.status === "finished" || match.finished_at) {
      return showToast("Ne možete dodavati golove u završenom meču", "error");
    }
    const teamId = teams[key]?.id;
    await addGoal({
      match_id: matchId,
      team_id: teamId,
      player_id: p.id,
      minute: Math.floor((match.duration_seconds - liveSeconds) / 60),
    });
    showToast(`Gol za ${teams[key]?.name}!`, "success");
  };

  const handleMinus = async (key) => {
    if (guard()) return;
    if (match.status === "finished" || match.finished_at) {
      return showToast("Ne možete mijenjati rezultat završnog meča", "error");
    }
    const ok = await quickMinusGoal(matchId, teams[key].id);
    if (!ok) setConfirmUndo(true);
    else showToast("Gol uklonjen", "info");
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00E0FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#A1A1AA] text-lg">Učitavam utakmicu...</p>
        </div>
      </div>
    );
  }

  const displayTime = formatMMSS(liveSeconds);
  const scoreA = match.score_a ?? 0;
  const scoreB = match.score_b ?? 0;
  const isFinished = match.status === "finished" || match.finished_at;
  const elapsedMinutes = Math.floor((match.duration_seconds - liveSeconds) / 60);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27] text-white">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 px-6 py-4 rounded-xl shadow-2xl text-sm font-bold transition-all z-50 flex items-center gap-3 ${
            toast.type === "success"
              ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
              : toast.type === "error"
              ? "bg-gradient-to-r from-red-500 to-red-600 text-white"
              : "bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] text-black"
          }`}
        >
          {toast.type === "success" && <CheckCircle2 className="w-5 h-5" />}
          {toast.type === "error" && <AlertCircle className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="bg-[#18181B]/50 backdrop-blur-xl border-b border-[#2C2C2F] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              to={profile ? "/dashboard/schedule" : "/"}
              className="flex items-center gap-2 text-[#A1A1AA] hover:text-white transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Povratak</span>
            </Link>

            <div className="flex items-center gap-3">
              {match.is_running ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-full animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-red-400 text-sm font-bold">LIVE</span>
                </div>
              ) : isFinished ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-full">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm font-bold">ZAVRŠENO</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/40 rounded-full">
                  <Pause className="w-4 h-4 text-amber-300" />
                  <span className="text-amber-300 text-sm font-bold">PAUZA</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* MATCH INFO BANNER */}
        <div className="bg-gradient-to-r from-[#00E0FF]/10 via-[#7C3AED]/10 to-[#EC4899]/10 border border-[#00E0FF]/20 rounded-2xl p-6 mb-8">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Trophy className="w-6 h-6 text-[#00E0FF]" />
              <span className="text-[#A1A1AA] text-sm font-semibold uppercase tracking-wider">
                {match.round || "Utakmica"} {match.group_label ? `• ${match.group_label}` : ""}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black">
              {teams.A?.name} <span className="text-[#00E0FF]">VS</span> {teams.B?.name}
            </h1>
          </div>
        </div>

        {/* SCOREBOARD */}
        <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border-2 border-[#2C2C2F] rounded-3xl p-8 mb-8 shadow-2xl">
          {/* Score Display */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
            {/* Team A */}
            <div className="flex-1 text-center">
              <div className="mb-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center mb-3 shadow-lg shadow-[#00E0FF]/30">
                  <span className="text-3xl font-black text-white">
                    {teams.A?.name?.charAt(0)}
                  </span>
                </div>
                <h3 className="text-xl font-bold">{teams.A?.name}</h3>
              </div>
              
              {canManage && !isFinished && (
                <button
                  onClick={() => handleMinus("A")}
                  className="p-3 rounded-xl border-2 border-[#2C2C2F] hover:border-red-500 hover:bg-red-500/10 transition-all group"
                >
                  <Minus className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>

            {/* Score */}
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-6 mb-4">
                <div className="text-7xl md:text-8xl font-black text-[#00E0FF] tracking-tight">
                  {scoreA}
                </div>
                <div className="text-4xl md:text-5xl font-black text-[#666]">:</div>
                <div className="text-7xl md:text-8xl font-black text-[#7C3AED] tracking-tight">
                  {scoreB}
                </div>
              </div>

              {/* Timer */}
              <div className="relative">
                <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl ${
                  match.is_running 
                    ? "bg-red-500/20 border-2 border-red-500/40" 
                    : isFinished
                    ? "bg-green-500/20 border-2 border-green-500/40"
                    : "bg-[#2C2C2F] border-2 border-[#2C2C2F]"
                }`}>
                  <ClockIcon className={`w-6 h-6 ${
                    match.is_running ? "text-red-400" : isFinished ? "text-green-400" : "text-[#00E0FF]"
                  }`} />
                  <span className="text-4xl font-mono font-black">{displayTime}</span>
                </div>
                <div className="mt-3 text-sm text-[#666] font-semibold">
                  Minute: {elapsedMinutes}'
                </div>
              </div>
            </div>

            {/* Team B */}
            <div className="flex-1 text-center">
              <div className="mb-4">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center mb-3 shadow-lg shadow-[#7C3AED]/30">
                  <span className="text-3xl font-black text-white">
                    {teams.B?.name?.charAt(0)}
                  </span>
                </div>
                <h3 className="text-xl font-bold">{teams.B?.name}</h3>
              </div>
              
              {canManage && !isFinished && (
                <button
                  onClick={() => handleMinus("B")}
                  className="p-3 rounded-xl border-2 border-[#2C2C2F] hover:border-red-500 hover:bg-red-500/10 transition-all group"
                >
                  <Minus className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>
          </div>

          {/* CONTROLS (ADMIN ONLY) */}
          {canManage && (
            <div className="border-t border-[#2C2C2F] pt-6">
              <div className="flex justify-center flex-wrap gap-3">
                {match.is_running ? (
                  <button
                    onClick={handlePause}
                    disabled={isFinished}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-black font-bold transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                  >
                    <Pause className="w-5 h-5" />
                    Pauziraj
                  </button>
                ) : (
                  <button
                    onClick={handleStart}
                    disabled={isFinished}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                  >
                    <Play className="w-5 h-5" />
                    Pokreni
                  </button>
                )}
                
                <button
                  onClick={handleReset}
                  disabled={isFinished}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#18181B] border-2 border-[#2C2C2F] hover:border-[#00E0FF] text-white font-bold transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-5 h-5" />
                  Reset
                </button>
                
                <button
                  onClick={handleFinish}
                  disabled={isFinished}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold transition-all hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
                >
                  <Flag className="w-5 h-5" />
                  Završi
                </button>
              </div>

              {!canManage && (
                <p className="text-center text-[#666] text-sm mt-4">
                  Kontrole su dostupne samo administratorima
                </p>
              )}
            </div>
          )}
        </div>

        {/* PLAYERS */}
        <div className="grid lg:grid-cols-2 gap-6">
          {["A", "B"].map((key, idx) => (
            <div 
              key={key} 
              className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl shadow-xl overflow-hidden"
            >
              <div className={`p-6 border-b border-[#2C2C2F] ${
                idx === 0 
                  ? "bg-gradient-to-r from-[#00E0FF]/5 to-transparent" 
                  : "bg-gradient-to-r from-[#7C3AED]/5 to-transparent"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${
                      idx === 0 
                        ? "bg-gradient-to-br from-[#00E0FF] to-[#7C3AED]" 
                        : "bg-gradient-to-br from-[#7C3AED] to-[#EC4899]"
                    } flex items-center justify-center shadow-lg`}>
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{teams[key]?.name}</h3>
                      <p className="text-xs text-[#666]">{players[key].length} igrača</p>
                    </div>
                  </div>

                  {canManage && !isFinished && (
                    <button
                      onClick={() => undoLastGoal(matchId, teams[key].id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-semibold transition-all hover:scale-105"
                    >
                      <Undo2 className="w-4 h-4" />
                      Undo
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                {players[key].length > 0 ? (
                  players[key].map((p, i) => {
                    const goalCount = playerGoals.get(p.id) || 0;
                    const clickable = canManage && !isFinished;
                    return (
                      <div
                        key={p.id}
                        onClick={clickable ? () => handleAddGoal(key, p) : undefined}
                        className={`group flex items-center justify-between p-4 border border-[#2C2C2F] rounded-xl transition-all ${
                          clickable 
                            ? "cursor-pointer hover:bg-[#18181B] hover:border-[#00E0FF]/40 hover:scale-[1.02]" 
                            : "bg-[#0D1117] cursor-default opacity-60"
                        }`}
                        title={clickable ? "Klikni za dodavanje gola" : ""}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                            idx === 0
                              ? "bg-[#00E0FF]/20 text-[#00E0FF]"
                              : "bg-[#7C3AED]/20 text-[#7C3AED]"
                          }`}>
                            {i + 1}
                          </div>
                          <div>
                            <p className="text-white font-bold">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-xs text-[#666]">
                              {clickable ? "Klikni za gol" : "Samo pregled"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {goalCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00E0FF]/20 border border-[#00E0FF]/40">
                              <Trophy className="w-4 h-4 text-[#00E0FF]" />
                              <span className="text-[#00E0FF] font-black text-lg">{goalCount}</span>
                            </div>
                          )}
                          {clickable && (
                            <div className="p-2 rounded-lg bg-[#00E0FF]/10 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-5 h-5 text-[#00E0FF]" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-[#666] mx-auto mb-3" />
                    <p className="text-[#666]">Nema igrača u ekipi</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Match Stats */}
        {goals.length > 0 && (
          <div className="mt-8 bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-6 h-6 text-[#00E0FF]" />
              <h3 className="text-xl font-bold">Statistika utakmice</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#0D1117] border border-[#2C2C2F] rounded-xl text-center">
                <Trophy className="w-6 h-6 text-[#00E0FF] mx-auto mb-2" />
                <p className="text-2xl font-black">{goals.length}</p>
                <p className="text-xs text-[#666]">Ukupno golova</p>
              </div>
              <div className="p-4 bg-[#0D1117] border border-[#2C2C2F] rounded-xl text-center">
                <Target className="w-6 h-6 text-[#7C3AED] mx-auto mb-2" />
                <p className="text-2xl font-black">{scoreA + scoreB}</p>
                <p className="text-xs text-[#666]">Rezultat</p>
              </div>
              <div className="p-4 bg-[#0D1117] border border-[#2C2C2F] rounded-xl text-center">
                <ClockIcon className="w-6 h-6 text-[#EC4899] mx-auto mb-2" />
                <p className="text-2xl font-black">{elapsedMinutes}'</p>
                <p className="text-xs text-[#666]">Odigrano minuta</p>
              </div>
              <div className="p-4 bg-[#0D1117] border border-[#2C2C2F] rounded-xl text-center">
                <Award className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-2xl font-black">
                  {scoreA > scoreB ? teams.A?.name?.substring(0, 3) : scoreB > scoreA ? teams.B?.name?.substring(0, 3) : "–"}
                </p>
                <p className="text-xs text-[#666]">Vodi</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* UNDO POPUP */}
      {confirmUndo && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#00E0FF]/20 rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-[#00E0FF]/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-[#00E0FF]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Nema golova
            </h3>
            <p className="text-[#A1A1AA] mb-6">
              Nije pronađen niti jedan gol koji se može poništiti za ovu ekipu.
            </p>
            <button
              onClick={() => setConfirmUndo(false)}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] text-black rounded-xl font-bold hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] transition-all hover:scale-105"
            >
              U redu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}