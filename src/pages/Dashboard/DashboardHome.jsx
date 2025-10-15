// src/pages/Dashboard/DashboardHome.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getMatchesBySport, getTeamsByIds, supabase } from "../../services/api";

import {
  Users,
  Trophy,
  CalendarClock,
  BarChart2,
  PlusCircle,
  ListOrdered,
  Activity,
  Clock,
  TrendingUp,
  Zap,
  Target,
  Award,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export default function DashboardHome() {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  const [sportName, setSportName] = useState("");
  const [teamsCount, setTeamsCount] = useState(0);
  const [playedCount, setPlayedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [nextMatch, setNextMatch] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);

  useEffect(() => {
    if (loading || !profile?.sport_id) return;

    (async () => {
      try {
        const sportId = profile.sport_id;

        // 1) Ime sporta
        const { data: sport } = await supabase
          .from("sports")
          .select("name")
          .eq("id", sportId)
          .maybeSingle();
        setSportName(sport?.name || `Sport #${sportId}`);

        // 2) Broj ekipa
        const { count: tCount } = await supabase
          .from("teams")
          .select("*", { count: "exact", head: true })
          .eq("sport_id", sportId);
        setTeamsCount(tCount || 0);

        // 3) Sve utakmice (osnovni shape)
        const baseMatches = await getMatchesBySport(sportId);
        if (!baseMatches || baseMatches.length === 0) {
          setTotalCount(0);
          setPlayedCount(0);
          setRecentMatches([]);
          setNextMatch(null);
          return;
        }

        const ids = baseMatches.map((m) => m.id);

        // 3a) Dohvati status/is_running/finished_at — tolerantno
        let extById = {};
        try {
          const { data: ext } = await supabase
            .from("matches")
            .select("id,status,finished_at,is_running")
            .in("id", ids);
          (ext || []).forEach((e) => {
            extById[e.id] = {
              status: e.status || null,
              finished_at: e.finished_at || null,
              is_running: !!e.is_running,
            };
          });
        } catch {
          // RLS ili error — nastavljamo bez
        }

        // 3b) Spoji i normaliziraj
        const matches = baseMatches.map((m) => {
          const ext = extById[m.id] || {};
          const primaryStatus =
            ext.status === "finished"
              ? "finished"
              : ext.status === "live"
              ? "live"
              : "scheduled";

          const hasScore =
            Number.isFinite(m.score_a) && Number.isFinite(m.score_b);
          const finished = primaryStatus === "finished" || !!ext.finished_at;

          return {
            ...m,
            status: finished ? "finished" : primaryStatus,
            finished_at: ext.finished_at || null,
            is_running: !!ext.is_running,
            _hasScore: hasScore,
          };
        });

        // 4) Team names (mapa)
        const teamIds = Array.from(
          new Set(matches.flatMap((m) => [m.team_a_id, m.team_b_id]))
        ).filter(Boolean);
        const teams = await getTeamsByIds(teamIds);
        const teamMap = (teams || []).reduce((acc, t) => {
          acc[t.id] = t;
          return acc;
        }, {});

        // 5) Statistika odigrano/ukupno
        const total = matches.length;
        const played = matches.filter(
          (m) => m.status === "finished" || m._hasScore
        ).length;
        setTotalCount(total);
        setPlayedCount(played);

        // 6) Sljedeći susret — prvo ne-završeno u budućnosti
        const now = new Date();
        const next = matches
          .filter((m) => {
            if (!m.start_time) return false;
            if (m.status === "finished") return false;
            return new Date(m.start_time) > now;
          })
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))[0];

        if (next) {
          setNextMatch({
            ...next,
            team_a: teamMap[next.team_a_id] || null,
            team_b: teamMap[next.team_b_id] || null,
          });
        } else {
          setNextMatch(null);
        }

        // 7) Nedavne aktivnosti (6 najnovijih)
        const recent = [...matches]
          .sort((a, b) => {
            const ta = a.start_time ? new Date(a.start_time).getTime() : 0;
            const tb = b.start_time ? new Date(b.start_time).getTime() : 0;
            return tb - ta;
          })
          .slice(0, 6)
          .map((m) => ({
            id: m.id,
            teamA: teamMap[m.team_a_id]?.name || "Ekipa A",
            teamB: teamMap[m.team_b_id]?.name || "Ekipa B",
            scoreA: m.score_a,
            scoreB: m.score_b,
            time: m.start_time,
            status: m.status,
          }));
        setRecentMatches(recent);
      } catch (e) {
        console.error("Dashboard load error:", e);
      }
    })();
  }, [profile?.sport_id, loading]);

  if (loading) return null;
  if (!profile?.sport_id)
    return <p className="p-6 text-gray-400">Nemate pridružen sport.</p>;

  // --------- Vizualni podaci ----------
  const COLORS = ["#00E0FF", "#2C2C2F"];
  const pieData = [
    { name: "Odigrano", value: playedCount },
    { name: "Preostalo", value: Math.max(0, totalCount - playedCount) },
  ];
  const completionRate =
    totalCount > 0 ? Math.round((playedCount / totalCount) * 100) : 0;

  // Demo weekly progress (možeš zamijeniti stvarnim ako želiš)
  const progressData = [
    { name: "Pon", utakmice: 4 },
    { name: "Uto", utakmice: 3 },
    { name: "Sri", utakmice: 5 },
    { name: "Čet", utakmice: 6 },
    { name: "Pet", utakmice: 4 },
    { name: "Sub", utakmice: 0 },
    { name: "Ned", utakmice: 0 },
  ];

  // --------- UI helpers ----------
  const StatCard = ({
    icon: Icon,
    title,
    value,
    subtitle,
    trend,
    color = "#00E0FF",
    gradient,
  }) => (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group cursor-pointer">
      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
          gradient || "bg-gradient-to-br from-[#00E0FF]/5 to-transparent"
        }`}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div
            className="p-3 rounded-xl group-hover:scale-110 transition-transform duration-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,224,255,0.2), rgba(0,224,255,0.05))",
            }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-green-400 text-xs font-bold px-2 py-1 bg-green-400/10 rounded-lg">
              <TrendingUp size={12} />
              {trend}
            </div>
          )}
        </div>
        <h3 className="text-[#A1A1AA] text-sm font-medium mb-2">{title}</h3>
        <p className="text-3xl font-black text-white mb-1 tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-[#666] font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );

  const QuickAction = ({ icon: Icon, label, onClick, variant = "primary" }) => {
    const variants = {
      primary:
        "bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] text-black hover:shadow-[0_0_30px_rgba(0,224,255,0.4)]",
      secondary:
        "bg-[#18181B] border-2 border-[#2C2C2F] text-white hover:border-[#00E0FF]",
    };
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold transition-all duration-300 hover:scale-105 group ${variants[variant]}`}
      >
        <Icon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span>{label}</span>
        <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2">
              Dashboard
            </h1>
            <p className="text-[#A1A1AA] text-lg">
              Dobro došli nazad! Upravljajte{" "}
              <span className="text-[#00E0FF] font-bold">{sportName}</span>{" "}
              natjecanjem
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-[#00E0FF]/10 to-[#7C3AED]/10 border border-[#00E0FF]/20 rounded-xl">
            <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-bold">Sustav aktivan</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid lg:grid-cols-4 sm:grid-cols-2 grid-cols-1 gap-6 mb-8">
        <StatCard
          icon={Trophy}
          title="Ukupno ekipa"
          value={teamsCount}
          subtitle="Registrirane ekipe"
          trend="+2"
          color="#00E0FF"
        />
        <StatCard
          icon={Target}
          title="Napredak"
          value={`${completionRate}%`}
          subtitle={`${playedCount} od ${totalCount} utakmica`}
          color="#7C3AED"
          gradient="bg-gradient-to-br from-[#7C3AED]/5 to-transparent"
        />
        <StatCard
          icon={Zap}
          title="Ukupno utakmica"
          value={totalCount}
          subtitle={`${Math.max(0, totalCount - playedCount)} preostalo`}
          color="#EC4899"
          gradient="bg-gradient-to-br from-[#EC4899]/5 to-transparent"
        />
        <StatCard
          icon={Award}
          title="Završeno"
          value={playedCount}
          subtitle="Odigrane utakmice"
          trend={playedCount > 0 ? "+✔" : undefined}
          color="#10B981"
          gradient="bg-gradient-to-br from-[#10B981]/5 to-transparent"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Charts (2 kolone) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Line chart */}
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#00E0FF]" />
                Sedmični pregled
              </h2>
              <span className="text-xs font-semibold text-[#A1A1AA] px-3 py-1 bg-[#2C2C2F] rounded-lg">
                Ovaj tjedan
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2C2C2F" />
                  <XAxis dataKey="name" stroke="#A1A1AA" style={{ fontSize: 12 }} />
                  <YAxis stroke="#A1A1AA" style={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181B",
                      border: "1px solid #2C2C2F",
                      borderRadius: "10px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="utakmice"
                    stroke="#00E0FF"
                    strokeWidth={3}
                    dot={{ fill: "#00E0FF", r: 6 }}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie chart */}
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl p-6 shadow-lg">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#7C3AED]" />
              Statistika natjecanja
            </h2>
            <div className="flex items-center justify-between">
              <div className="h-48 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      paddingAngle={5}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#18181B",
                        border: "1px solid #2C2C2F",
                        borderRadius: "10px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-[#00E0FF]" />
                  <div>
                    <p className="text-sm text-[#A1A1AA]">Odigrano</p>
                    <p className="text-2xl font-bold">{playedCount}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-[#2C2C2F]" />
                  <div>
                    <p className="text-sm text-[#A1A1AA]">Preostalo</p>
                    <p className="text-2xl font-bold">
                      {Math.max(0, totalCount - playedCount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desni sidebar */}
        <div className="space-y-6">
          {/* Next match */}
          <div className="bg-gradient-to-br from-[#00E0FF] via-[#7C3AED] to-[#EC4899] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <CalendarClock className="w-5 h-5 text-white" />
              <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider">
                Sljedeća utakmica
              </h3>
            </div>
            {nextMatch ? (
              <>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4">
                  <div className="text-center mb-2">
                    <p className="text-white font-bold text-lg">
                      {nextMatch.team_a?.name}
                    </p>
                    <p className="text-white/80 text-sm my-2">VS</p>
                    <p className="text-white font-bold text-lg">
                      {nextMatch.team_b?.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 text-white/90 text-sm">
                  <Clock size={14} />
                  <span className="font-medium">
                    {new Date(nextMatch.start_time).toLocaleString("hr-HR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-white/90 text-center py-4">
                Nema zakazanih utakmica
              </p>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#00E0FF]" />
              Brze akcije
            </h3>
            <div className="space-y-3">
              <QuickAction
                icon={PlusCircle}
                label="Nova ekipa"
                variant="primary"
                onClick={() => navigate("/dashboard/teams")}
              />
              <QuickAction
                icon={ListOrdered}
                label="Raspored"
                variant="secondary"
                onClick={() => navigate("/dashboard/schedule")}
              />
              <QuickAction
                icon={Users}
                label="Tablica"
                variant="secondary"
                onClick={() => navigate("/dashboard/standings")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl p-6 shadow-lg">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#00E0FF]" />
          Nedavne aktivnosti
        </h2>

        {recentMatches.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {recentMatches.map((m) => {
              const played =
                Number.isFinite(m.scoreA) && Number.isFinite(m.scoreB);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-4 p-4 bg-[#0D1117] border border-[#2C2C2F] rounded-xl hover:border-[#00E0FF]/40 transition-all duration-300 cursor-pointer group hover:scale-[1.02]"
                >
                  <div
                    className={`p-3 rounded-xl ${
                      played
                        ? "bg-green-500/20 text-green-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {played ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-bold text-sm truncate">
                        {m.teamA}
                      </p>
                      <span className="text-[#00E0FF] font-bold text-xs">VS</span>
                      <p className="text-white font-bold text-sm truncate">
                        {m.teamB}
                      </p>
                    </div>

                    {played ? (
                      <p className="text-[#00E0FF] font-bold text-lg">
                        {m.scoreA} - {m.scoreB}
                      </p>
                    ) : (
                      <p className="text-[#A1A1AA] text-xs">Zakazano</p>
                    )}

                    <p className="text-[#666] text-xs mt-1">
                      {m.time
                        ? new Date(m.time).toLocaleString("hr-HR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </p>
                  </div>

                  <ChevronRight
                    size={18}
                    className="text-[#666] group-hover:text-[#00E0FF] group-hover:translate-x-1 transition-all"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-[#666] mx-auto mb-3" />
            <p className="text-[#A1A1AA]">Nema zabilježenih aktivnosti</p>
          </div>
        )}
      </div>
    </div>
  );
}
