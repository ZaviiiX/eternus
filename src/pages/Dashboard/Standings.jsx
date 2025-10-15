import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getStandings, supabase } from "../../services/api";
import {
  Trophy,
  Medal,
  Target,
  TrendingUp,
  TrendingDown,
  Award,
  Crown,
  Zap,
  Filter,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle
} from "lucide-react";

export default function Standings() {
  const { profile, loading } = useAuth();
  const [standings, setStandings] = useState([]);
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState([]);
  const [group, setGroup] = useState(null);
  const [topScorer, setTopScorer] = useState(null);

  // Load top scorer
  const loadTopScorer = async (sportId) => {
    try {
      const { data, error } = await supabase
        .from("goals")
        .select(`
          player_id,
          players!inner(first_name, last_name, team_id),
          teams!inner(sport_id)
        `)
        .eq("teams.sport_id", sportId);

      if (error) throw error;

      // Count goals per player
      const goalCounts = {};
      (data || []).forEach(goal => {
        const playerId = goal.player_id;
        if (!goalCounts[playerId]) {
          goalCounts[playerId] = {
            count: 0,
            firstName: goal.players?.first_name,
            lastName: goal.players?.last_name
          };
        }
        goalCounts[playerId].count++;
      });

      // Find top scorer
      const topPlayer = Object.values(goalCounts).sort((a, b) => b.count - a.count)[0];
      setTopScorer(topPlayer || null);
    } catch (e) {
      console.error("Top scorer load error:", e);
      setTopScorer(null);
    }
  };

  useEffect(() => {
    if (loading || !profile?.sport_id) return;
    const load = async () => {
      setBusy(true);
      try {
        const data = await getStandings(profile.sport_id, group || null);
        const list = data || [];
        
        // Client-side sort
        list.sort((a, b) => {
          const pa = Number(a.points ?? 0);
          const pb = Number(b.points ?? 0);
          if (pb !== pa) return pb - pa;
          const gda = Number(a.goal_difference ?? a.goal_diff ?? a.diff ?? 0);
          const gdb = Number(b.goal_difference ?? b.goal_diff ?? b.diff ?? 0);
          return gdb - gda;
        });
        setStandings(list);

        // Extract groups
        const g = Array.from(
          new Set((data || []).map((r) => r.group_label).filter(Boolean))
        );
        setGroups(g);

        // Load top scorer
        await loadTopScorer(profile.sport_id);
      } catch (e) {
        console.error("Standings load error:", e);
        setStandings([]);
        setGroups([]);
      } finally {
        setBusy(false);
      }
    };
    load();
  }, [loading, profile?.sport_id, group]);

  if (loading) return null;
  if (!profile?.sport_id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-[#666] mx-auto mb-4" />
          <p className="text-[#A1A1AA] text-lg">Nemate pridružen sport.</p>
        </div>
      </div>
    );
  }

  const topTeam = standings[0];
  const totalGoals = standings.reduce((sum, s) => 
    sum + (Number(s.goals_for ?? s.gf ?? s.scored ?? 0)), 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              Tablica poretka
            </h1>
            <p className="text-[#A1A1AA]">Poredak timova i statistike natjecanja</p>
          </div>

          {groups.length > 0 && (
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-[#A1A1AA]" />
              <select
                value={group ?? ""}
                onChange={(e) => setGroup(e.target.value || null)}
                className="bg-[#18181B] border-2 border-[#2C2C2F] text-white px-5 py-3 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-[#00E0FF] focus:border-[#00E0FF] transition-all"
              >
                <option value="">Sve grupe</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Leader Card */}
          <div className="bg-gradient-to-br from-[#00E0FF] via-[#7C3AED] to-[#EC4899] rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/90 text-sm font-bold uppercase tracking-wider">
                Vodeća ekipa
              </span>
            </div>
            {topTeam ? (
              <>
                <p className="text-2xl font-black text-white mb-1">
                  {topTeam.team_name || topTeam.team || "–"}
                </p>
                <p className="text-white/80 text-sm font-semibold">
                  {topTeam.points ?? topTeam.pts ?? 0} bodova
                </p>
              </>
            ) : (
              <p className="text-white/80 text-sm">Još nema podataka</p>
            )}
          </div>

          {/* Top Scorer Card */}
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl p-6 hover:border-[#00E0FF]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-[#00E0FF]/20">
                <Target className="w-6 h-6 text-[#00E0FF]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-bold uppercase tracking-wider">
                Najbolji strijelac
              </span>
            </div>
            {topScorer ? (
              <>
                <p className="text-2xl font-black text-white mb-1">
                  {topScorer.firstName} {topScorer.lastName}
                </p>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#00E0FF]" />
                  <span className="text-[#00E0FF] text-sm font-bold">
                    {topScorer.count} {topScorer.count === 1 ? 'gol' : topScorer.count < 5 ? 'gola' : 'golova'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[#666] text-sm">Još nema golova</p>
            )}
          </div>

          {/* Total Goals Card */}
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-2xl p-6 hover:border-[#7C3AED]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-[#7C3AED]/20">
                <Zap className="w-6 h-6 text-[#7C3AED]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-bold uppercase tracking-wider">
                Ukupno golova
              </span>
            </div>
            <p className="text-3xl font-black text-[#7C3AED]">{totalGoals}</p>
          </div>
        </div>
      </div>

      {/* Standings Table */}
      <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl shadow-2xl border border-[#2C2C2F] overflow-hidden">
        {busy ? (
          <div className="p-12 text-center">
            <Loader2 className="w-12 h-12 text-[#00E0FF] mx-auto mb-4 animate-spin" />
            <p className="text-[#A1A1AA] text-lg">Učitavam tablicu...</p>
          </div>
        ) : standings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#00E0FF]/10 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-[#00E0FF]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Nema podataka</h3>
            <p className="text-[#A1A1AA]">Tablica će biti dostupna nakon prvih rezultata</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0D1117] border-b border-[#2C2C2F]">
                <tr>
                  <th className="p-4 text-left text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Medal className="w-4 h-4" />
                      Poz
                    </div>
                  </th>
                  <th className="p-4 text-left text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4" />
                      Ekipa
                    </div>
                  </th>
                  <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">P</th>
                  <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">W</th>
                  <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">D</th>
                  <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">L</th>
                  <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">GF</th>
                  <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">GA</th>
                  <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      GD
                    </div>
                  </th>
                  <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                    <div className="flex items-center justify-center gap-2">
                      <Award className="w-4 h-4" />
                      Bod
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2C2C2F]">
                {standings.map((s, i) => {
                  const played = s.played ?? s.matches_played ?? s.p ?? 
                    (s.wins && s.losses ? s.wins + s.draws + s.losses : undefined);
                  const wins = s.wins ?? s.w ?? 0;
                  const draws = s.draws ?? s.d ?? 0;
                  const losses = s.losses ?? s.l ?? 0;
                  const gf = s.goals_for ?? s.gf ?? s.scored ?? 0;
                  const ga = s.goals_against ?? s.ga ?? s.conceded ?? 0;
                  const gd = s.goal_difference ?? s.goal_diff ?? s.diff ?? gf - ga;
                  const pts = s.points ?? s.pts ?? 0;

                  const isTop3 = i < 3;
                  const isFirst = i === 0;

                  return (
                    <tr 
                      key={i} 
                      className={`hover:bg-[#0D1117] transition-all duration-200 group ${
                        isFirst ? "bg-gradient-to-r from-[#00E0FF]/5 to-transparent" : ""
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {isTop3 ? (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                              isFirst 
                                ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg shadow-yellow-500/30" 
                                : i === 1
                                ? "bg-gradient-to-br from-gray-300 to-gray-500 text-black shadow-lg"
                                : "bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg"
                            }`}>
                              {i + 1}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-[#2C2C2F] flex items-center justify-center text-[#A1A1AA] font-bold text-sm">
                              {i + 1}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                            isFirst
                              ? "bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] text-white shadow-lg shadow-[#00E0FF]/30"
                              : "bg-[#2C2C2F] text-[#00E0FF]"
                          }`}>
                            {(s.team_name || s.team || "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-bold ${isFirst ? "text-white text-lg" : "text-white"}`}>
                              {s.team_name || s.team || "-"}
                            </p>
                            {s.group_label && (
                              <p className="text-xs text-[#666]">{s.group_label}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center text-[#A1A1AA] font-semibold">{played ?? "-"}</td>
                      <td className="p-4 text-center text-green-400 font-semibold">{wins}</td>
                      <td className="p-4 text-center text-amber-400 font-semibold">{draws}</td>
                      <td className="p-4 text-center text-red-400 font-semibold">{losses}</td>
                      <td className="p-4 text-center text-[#A1A1AA] font-semibold">{gf}</td>
                      <td className="p-4 text-center text-[#A1A1AA] font-semibold">{ga}</td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {gd > 0 ? (
                            <>
                              <TrendingUp className="w-4 h-4 text-green-400" />
                              <span className="text-green-400 font-bold">+{gd}</span>
                            </>
                          ) : gd < 0 ? (
                            <>
                              <TrendingDown className="w-4 h-4 text-red-400" />
                              <span className="text-red-400 font-bold">{gd}</span>
                            </>
                          ) : (
                            <span className="text-[#A1A1AA] font-semibold">0</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className={`inline-flex items-center justify-center px-4 py-2 rounded-lg font-black text-lg ${
                          isFirst
                            ? "bg-[#00E0FF]/20 text-[#00E0FF] border-2 border-[#00E0FF]/40"
                            : "text-white"
                        }`}>
                          {pts}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      {standings.length > 0 && (
        <div className="mt-6 bg-[#18181B]/50 border border-[#2C2C2F] rounded-xl p-4">
          <div className="flex flex-wrap gap-6 text-xs text-[#A1A1AA]">
            <div className="flex items-center gap-2">
              <span className="font-bold">P</span> = Odigrano
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-400">W</span> = Pobjede
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-400">D</span> = Neriješeno
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-red-400">L</span> = Porazi
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">GF</span> = Golovi dani
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">GA</span> = Golovi primljeni
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">GD</span> = Gol razlika
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">Bod</span> = Bodovi
            </div>
          </div>
        </div>
      )}
    </div>
  );
}