import { useEffect, useState } from "react";
import { supabase, getRecentMatches } from "../services/api";
import {
  BarChart2,
  TrendingUp,
  Clock,
  Trophy,
  Calendar,
  ChevronRight,
  Flame,
  Pause,
  CheckCircle2,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

/* ============ ⏱ helperi ============ */
function computeElapsedSeconds(m) {
  let elapsed = Number(m.elapsed_seconds ?? 0);
  if (m.is_running && m.last_started_at) {
    const delta = Math.floor(
      (Date.now() - new Date(m.last_started_at).getTime()) / 1000
    );
    elapsed += delta;
  }
  return Math.max(0, elapsed);
}
function computeRemainingSeconds(m) {
  const duration = Number(m.duration_seconds ?? 600);
  return Math.max(0, duration - computeElapsedSeconds(m));
}
function mmss(sec) {
  const s = Math.max(0, sec | 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// Render a small emoji or icon for a sport name. Returns an element (string is fine
// for emoji). Keep accessibility in mind: the caller wraps this in a span with
// appropriate visual sizing; use emoji + invisible label where helpful.
function renderSportIcon(name) {
  if (!name) return "🎯";
  const key = name.toLowerCase();
  if (key.includes("football") || key.includes("nogomet") || key.includes("soccer")) return "⚽";
  if (key.includes("tennis") || key.includes("stolni") || key.includes("table tennis")) return "🏓";
  if (key.includes("chess") || key.includes("šah") || key.includes("sah")) return "♟️";
  if (key.includes("volleyball") || key.includes("odbojka")) return "🏐";
  if (key.includes("stone") || key.includes("kamena")) return "🤾‍♂️";
  if (key.includes("ski") || key.includes("daskanje")) return "🎿";
  if (key.includes("bocanje") || key.includes("boćanje")) return "🪩";
  if (key.includes("dart") || key.includes("pikado")) return "🎯";
  if (key.includes("rope") || key.includes("konopa")) return "🪢";
  // fallback
  return "🏅";
}

export default function Home() {
  const [sports, setSports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [trending, setTrending] = useState([]);
  const [tick, setTick] = useState(0);
  const location = useLocation();

  /* 🔹 Učitaj sportske kategorije */
  useEffect(() => {
    const loadSports = async () => {
      const { data, error } = await supabase.from("sports").select("id, name");
      if (!error) setSports(data || []);
    };
    loadSports();
  }, []);

  /* 🔹 Učitaj "trending" */
  useEffect(() => {
    const loadTrending = async () => {
      try {
        const items = await getRecentMatches(5);
        setTrending(items || []);
      } catch {
        setTrending([]);
      }
    };
    loadTrending();
  }, []);

  /* 🔹 Učitaj aktivne i zakazane utakmice */
  useEffect(() => {
    async function loadMatches() {
      try {
        const { data: ms } = await supabase
          .from("matches")
          .select(
            `
            id, score_a, score_b, start_time,
            is_running, status, duration_seconds, elapsed_seconds, last_started_at,
            team_a:team_a_id ( name ),
            team_b:team_b_id ( name )
          `
          )
          .order("start_time", { ascending: true });

        const norm = (ms || []).map((m) => ({
          ...m,
          team_a_name: m.team_a?.name || "-",
          team_b_name: m.team_b?.name || "-",
          is_running: !!m.is_running,
          status:
            m.status === "finished"
              ? "finished"
              : m.status === "live"
              ? "live"
              : "scheduled",
          duration_seconds: Number(m.duration_seconds ?? 600),
          elapsed_seconds: Number(m.elapsed_seconds ?? 0),
          last_started_at: m.last_started_at || null,
        }));
        setMatches(norm);
      } catch (e) {
        console.error("Error loading public matches:", e?.message || e);
        setMatches([]);
      }
    }

    loadMatches();

    const interval = setInterval(() => setTick((t) => t + 1), 1000);

    const ch = supabase
      .channel("public_matches_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => loadMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, []);

  const liveCount = matches.filter((m) => m.status === "live").length;
  const upcomingCount = matches.filter((m) => m.status === "scheduled").length;
  const finishedCount = matches.filter((m) => m.status === "finished").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#040611] via-[#0D1117] to-[#020308]">
      {/* Top Navigation Bar */}
      <div className="bg-[#18181B]/80 backdrop-blur-xl border-b border-[#2C2C2F] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[#bff47b] to-[#8fbe5b] flex items-center justify-center shadow-lg shadow-[#bff47b]/50">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-[#0A0E27]" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-black text-white tracking-tight">
                  Gerovski Sportski Dan
                </h1>
                <p className="text-xs text-[#A1A1AA]">2026 Championship</p>
              </div>
            </div>
            {liveCount > 0 && (
              <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-500/20 border border-red-500/40 rounded-full animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs sm:text-sm font-bold text-red-400">
                  {liveCount} LIVE
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 gap-4 sm:gap-6">
        {/* LIJEVI SIDEBAR */}
        <nav className="w-64 hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#bff47b]/20 rounded-2xl p-5 shadow-2xl">
              <h2 className="text-sm font-bold text-[#bff47b] mb-4 flex items-center uppercase tracking-wider">
                <BarChart2 size={16} className="mr-2" /> Sportovi
              </h2>
                <ul className="space-y-2">
                {sports.map((s) => {
                  const isActive = location.pathname.includes(`/sport/${s.id}`);
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/sport/${s.id}`}
                        className={`group flex items-center gap-3 p-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                          isActive
                            ? "bg-gradient-to-r from-[#bff47b] to-[#8fbe5b] text-[#0A0E27] shadow-lg shadow-[#bff47b]/30"
                            : "text-[#A1A1AA] hover:bg-[#2C2C2F] hover:text-white"
                        }`}
                      >
                        <span className="text-2xl">{renderSportIcon(s.name)}</span>
                        <span className="flex-1">{s.name}</span>
                        <ChevronRight
                          className={`w-4 h-4 transition-all ${
                            isActive
                              ? "opacity-100 translate-x-0"
                              : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                          }`}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#bff47b]/20 rounded-2xl p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-[#bff47b] mb-4 uppercase tracking-wider">
                Statistika
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A1A1AA]">
                    Ukupno utakmica
                  </span>
                  <span className="text-lg font-bold text-[#bff47b]">
                    {matches.length}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A1A1AA]">Live sada</span>
                  <span className="text-lg font-bold text-red-400">
                    {liveCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A1A1AA]">Nadolazi</span>
                  <span className="text-lg font-bold text-blue-400">
                    {upcomingCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#A1A1AA]">Završeno</span>
                  <span className="text-lg font-bold text-green-400">
                    {finishedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* SREDIŠNJI SADRŽAJ */}
        <main className="flex-1 space-y-4 sm:space-y-6">
          {/* Hero Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#bff47b] via-[#a8db6a] to-[#8fbe5b] rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-2xl">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-20" />
            <div className="relative z-10 mb-3 sm:mb-5">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <Trophy size={24} className="sm:size-7 text-[#0A0E27]" />
                <span className="px-2 sm:px-3 py-1 bg-[#0A0E27]/20 backdrop-blur-sm rounded-full text-xs font-bold text-[#0A0E27]">
                  2026
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-2 text-[#0A0E27]">
                Dobrodošli na 12. Gerovski Sportski Dan!
              </h2>
              <p className="text-sm sm:text-base text-[#0A0E27]/80 mb-4 sm:mb-6 max-w-xl">
                Pratite rezultate uživo, statistike i sve najvažnije trenutke sa
                terena.
              </p>
              </div>
          </div>

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Clock size={20} className="sm:size-6 text-[#bff47b]" />
              Utakmice uživo
            </h3>
            <span className="text-xs sm:text-sm text-[#A1A1AA] flex items-center gap-2">
              <Calendar size={14} className="sm:size-4" />
              {new Date().toLocaleDateString("hr-HR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Matches List */}
          <div className="space-y-3">
            {matches.map((m) => {
              const isRunning = m.is_running;
              const isActive = m.status === "live";
              const isPaused = isActive && !isRunning;
              const isFinished = m.status === "finished";

              const displayScore =
                Number.isFinite(m.score_a) && Number.isFinite(m.score_b)
                  ? `${m.score_a} : ${m.score_b}`
                  : "VS";

              let remainingStr = null;
              let elapsedMinutes = null;
              if (isActive) {
                const rem = computeRemainingSeconds(m);
                const elapsed = Math.max(
                  0,
                  (Number(m.duration_seconds || 600) - rem) | 0
                );
                remainingStr = mmss(rem);
                elapsedMinutes = Math.floor(elapsed / 60);
              }

              const target = `/active-match/${m.id}`;

              return (
                <Link
                  key={m.id}
                  to={target}
                  className={`group relative overflow-hidden bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-xl sm:rounded-2xl transition-all duration-300 cursor-pointer border ${
                    isActive
                      ? "border-[#bff47b] shadow-[0_0_30px_rgba(191,244,123,0.3)] scale-[1.02]"
                      : "border-[#2C2C2F] hover:border-[#bff47b]/50 hover:scale-[1.01]"
                  }`}
                >
                  {/* Background pattern for active */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#bff47b]/5 to-transparent" />
                  )}

                  <div className="relative z-10 p-3 sm:p-5">
                    {/* DESKTOP LAYOUT */}
                    <div className="hidden sm:flex items-center gap-4">
                      {/* Status/Time Badge - FIKSNA ŠIRINA */}
                      <div className="w-[100px] flex-shrink-0">
                        {isRunning ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-red-400 text-sm font-bold whitespace-nowrap">
                              LIVE
                            </span>
                          </div>
                        ) : isPaused ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40">
                            <Pause size={14} className="text-amber-300" />
                            <span className="text-amber-300 text-sm font-bold whitespace-nowrap">
                              PAUZA
                            </span>
                          </div>
                        ) : isFinished ? (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/20 border border-green-500/40">
                            <CheckCircle2
                              size={14}
                              className="text-green-400"
                            />
                            <span className="text-green-400 text-sm font-bold whitespace-nowrap">
                              GOTOVO
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/20 border border-blue-500/40">
                            <Clock size={14} className="text-blue-400" />
                            <span className="text-blue-400 text-sm font-bold font-mono whitespace-nowrap">
                              {m.start_time
                                ? new Date(m.start_time).toLocaleTimeString(
                                    "hr-HR",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )
                                : "–"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Team A - FIKSNA ŠIRINA */}
                      <div className="w-[200px] flex-shrink-0 text-right">
                        <p className="text-white font-bold text-lg truncate">
                          {m.team_a_name}
                        </p>
                      </div>

                      {/* Score/VS - FIKSNA ŠIRINA */}
                      <div className="w-[120px] flex-shrink-0 text-center">
                        {isActive ? (
                          <div className="flex flex-col items-center justify-center">
                            <div className="text-4xl font-black text-[#bff47b] tracking-tight whitespace-nowrap">
                              {displayScore}
                            </div>
                            <div className="flex items-center justify-center gap-2 text-xs mt-1">
                              <Clock size={12} className="text-[#bff47b]" />
                              <span className="font-mono font-bold text-[#bff47b]">
                                {remainingStr}
                              </span>
                              <span className="text-[#A1A1AA]">
                                ({elapsedMinutes}')
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`text-3xl font-black tracking-tight whitespace-nowrap ${
                              isFinished ? "text-[#bff47b]" : "text-[#A1A1AA]"
                            }`}
                          >
                            {displayScore}
                          </div>
                        )}
                      </div>

                      {/* Team B - FIKSNA ŠIRINA */}
                      <div className="w-[200px] flex-shrink-0 text-left">
                        <p className="text-white font-bold text-lg truncate">
                          {m.team_b_name}
                        </p>
                      </div>

                      {/* Arrow */}
                      <div className="flex-1 flex justify-end">
                        <ChevronRight
                          className={`w-5 h-5 text-[#666] transition-all ${
                            isActive
                              ? "text-[#bff47b]"
                              : "group-hover:text-[#bff47b] group-hover:translate-x-1"
                          }`}
                        />
                      </div>
                    </div>

                    {/* MOBILE LAYOUT */}
                    <div className="sm:hidden space-y-3">
                      {/* Status Badge */}
                      <div className="flex items-center justify-between">
                        <div>
                          {isRunning ? (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 animate-pulse">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <span className="text-red-400 text-xs font-bold">
                                LIVE
                              </span>
                            </div>
                          ) : isPaused ? (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40">
                              <Pause size={12} className="text-amber-300" />
                              <span className="text-amber-300 text-xs font-bold">
                                PAUZA
                              </span>
                            </div>
                          ) : isFinished ? (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-500/20 border border-green-500/40">
                              <CheckCircle2 size={12} className="text-green-400" />
                              <span className="text-green-400 text-xs font-bold">
                                GOTOVO
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/40">
                              <Clock size={12} className="text-blue-400" />
                              <span className="text-blue-400 text-xs font-bold font-mono">
                                {m.start_time
                                  ? new Date(m.start_time).toLocaleTimeString(
                                      "hr-HR",
                                      { hour: "2-digit", minute: "2-digit" }
                                    )
                                  : "–"}
                              </span>
                            </div>
                          )}
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 text-[#666] ${
                            isActive ? "text-[#bff47b]" : ""
                          }`}
                        />
                      </div>

                      {/* Teams and Score */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate">
                            {m.team_a_name}
                          </p>
                        </div>
                        
                        <div className="text-center px-3">
                          {isActive ? (
                            <div className="flex flex-col items-center">
                              <div className="text-2xl font-black text-[#bff47b] whitespace-nowrap">
                                {displayScore}
                              </div>
                              <div className="flex items-center gap-1 text-xs mt-0.5">
                                <Clock size={10} className="text-[#bff47b]" />
                                <span className="font-mono font-bold text-[#bff47b]">
                                  {remainingStr}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`text-2xl font-black whitespace-nowrap ${
                                isFinished ? "text-[#bff47b]" : "text-[#A1A1AA]"
                              }`}
                            >
                              {displayScore}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-sm truncate text-right">
                            {m.team_b_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {matches.length === 0 && (
              <div className="text-center py-12 sm:py-16 bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-xl sm:rounded-2xl border border-[#2C2C2F]">
                <Calendar size={40} className="sm:size-12 mx-auto mb-3 sm:mb-4 text-[#A1A1AA]" />
                <p className="text-[#A1A1AA] text-base sm:text-lg">
                  Trenutno nema dostupnih utakmica.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* DESNI SIDEBAR */}
        <aside className="w-80 hidden xl:block">
          <div className="sticky top-24 space-y-4">
            {/* Trending */}
            <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#bff47b]/20 rounded-2xl p-5 shadow-2xl">
              <h2 className="text-sm font-bold text-[#bff47b] mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Flame size={16} /> Trending
              </h2>
              <div className="space-y-3">
                {trending.map((item, i) => (
                  <div
                    key={i}
                    className="p-4 bg-gradient-to-br from-[#2C2C2F] to-[#18181B] rounded-xl border border-[#2C2C2F] hover:border-[#bff47b] transition-all duration-300 cursor-pointer group hover:scale-105"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#bff47b] to-[#8fbe5b] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#0A0E27] font-bold text-sm">
                          #{i + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-[#bff47b] transition-colors truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-[#bff47b] mt-1 font-medium">
                          {item.value}
                        </p>
                        <p className="text-xs text-[#666] mt-1">{item.date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Promo Card */}
            <div className="bg-gradient-to-br from-[#bff47b] via-[#a8db6a] to-[#8fbe5b] rounded-2xl p-6 text-center shadow-2xl">
              <Trophy size={40} className="mx-auto mb-3 text-[#0A0E27]" />
              <h3 className="font-black text-lg text-[#0A0E27] mb-2">
                Postani Prvak!
              </h3>
              <p className="text-[#0A0E27]/80 text-sm mb-4">
                Pridruži se i osvoji nagrade
              </p>
              <button className="px-4 py-2 bg-[#0A0E27] text-[#bff47b] font-bold rounded-lg hover:scale-105 transition-transform text-sm">
                Saznaj više
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}