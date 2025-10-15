import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase, getSportNameSafe, getResultsBySport } from "../../services/api";
import {
  Trophy,
  TrendingUp,
  Clock,
  Target,
  Filter,
  Calendar,
  Award,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Users
} from "lucide-react";

export default function Results() {
  const { profile, loading } = useAuth();
  const [sportName, setSportName] = useState("");
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});

  const loadAll = async () => {
    if (!profile?.sport_id) return;
    setBusy(true);
    try {
      const [name, results] = await Promise.all([
        getSportNameSafe(profile.sport_id),
        getResultsBySport(profile.sport_id),
      ]);
      setSportName(name);
      const sorted = (results || []).slice().sort((a, b) => {
        const ta = new Date(a.start_time).getTime() || 0;
        const tb = new Date(b.start_time).getTime() || 0;
        return sortDesc ? tb - ta : ta - tb;
      });
      setRows(sorted);
      
      // Auto-expand all groups initially
      const groups = sorted.reduce((acc, r) => {
        const key = r.group_label || (r.round ? `R: ${r.round}` : 'General');
        acc[key] = true;
        return acc;
      }, {});
      setExpandedGroups(groups);
    } catch (e) {
      console.error("Results load error:", e);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!loading) loadAll();
  }, [loading, profile?.sport_id]);

  useEffect(() => {
    if (!profile?.sport_id) return;
    const ch = supabase
      .channel("results_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `sport_id=eq.${profile.sport_id}` },
        () => loadAll()
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [profile?.sport_id]);

  useEffect(() => {
    if (!loading && profile?.sport_id) loadAll();
  }, [sortDesc]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

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

  // Group rows by group_label
  const groups = rows.reduce((acc, r) => {
    const key = r.group_label || (r.round ? `${r.round}` : 'Općenito');
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  // Calculate stats
  const totalMatches = rows.length;
  const totalGoals = rows.reduce((sum, r) => 
    sum + (Number.isFinite(r.score_a) ? r.score_a : 0) + (Number.isFinite(r.score_b) ? r.score_b : 0), 0
  );
  const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : 0;
  const highestScore = rows.reduce((max, r) => {
    const total = (Number.isFinite(r.score_a) ? r.score_a : 0) + (Number.isFinite(r.score_b) ? r.score_b : 0);
    return total > max ? total : max;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27] text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              Rezultati
            </h1>
            <p className="text-[#A1A1AA]">
              Pregled rezultata za <span className="text-[#00E0FF] font-bold">{sportName}</span>
            </p>
          </div>

          <button
            onClick={() => setSortDesc((s) => !s)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#18181B] border-2 border-[#2C2C2F] hover:border-[#00E0FF] text-white font-semibold transition-all hover:scale-105"
          >
            <Filter className="w-5 h-5" />
            {sortDesc ? "Najnovije prvo" : "Najstarije prvo"}
            {sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-[#00E0FF]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#00E0FF]/20">
                <Trophy className="w-5 h-5 text-[#00E0FF]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Utakmica</span>
            </div>
            <p className="text-3xl font-black">{totalMatches}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-[#7C3AED]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#7C3AED]/20">
                <Target className="w-5 h-5 text-[#7C3AED]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Ukupno golova</span>
            </div>
            <p className="text-3xl font-black text-[#7C3AED]">{totalGoals}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-[#EC4899]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#EC4899]/20">
                <TrendingUp className="w-5 h-5 text-[#EC4899]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Prosjek golova</span>
            </div>
            <p className="text-3xl font-black text-[#EC4899]">{avgGoals}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-green-500/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Award className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Najviše golova</span>
            </div>
            <p className="text-3xl font-black text-green-400">{highestScore}</p>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-6">
        {busy ? (
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl border border-[#2C2C2F] p-12 text-center">
            <Loader2 className="w-12 h-12 text-[#00E0FF] mx-auto mb-4 animate-spin" />
            <p className="text-[#A1A1AA] text-lg">Učitavam rezultate...</p>
          </div>
        ) : !rows.length ? (
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl border border-[#2C2C2F] p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#00E0FF]/10 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-[#00E0FF]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Nema rezultata</h3>
            <p className="text-[#A1A1AA]">Još uvijek nema odigranih utakmica za prikaz</p>
          </div>
        ) : (
          Object.entries(groups)
            .sort((a, b) => {
              const ka = a[0];
              const kb = b[0];
              // push generic group 'Općenito' to the end
              if (ka === 'Općenito') return 1;
              if (kb === 'Općenito') return -1;
              return ka.localeCompare(kb, undefined, { numeric: true, sensitivity: 'base' });
            })
            .map(([groupName, items]) => {
            const isExpanded = expandedGroups[groupName];
            const groupGoals = items.reduce((sum, r) => 
              sum + (Number.isFinite(r.score_a) ? r.score_a : 0) + (Number.isFinite(r.score_b) ? r.score_b : 0), 0
            );

            return (
              <div 
                key={groupName} 
                className="bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl shadow-xl border border-[#2C2C2F] overflow-hidden"
              >
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full p-6 border-b border-[#2C2C2F] bg-gradient-to-r from-[#00E0FF]/5 to-transparent hover:from-[#00E0FF]/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-[#00E0FF]/30">
                        <Trophy className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-xl font-bold text-white">{groupName}</h3>
                        <p className="text-xs text-[#666]">
                          {items.length} utakmica • {groupGoals} golova
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-[#2C2C2F] rounded-lg">
                        <span className="text-xs text-[#A1A1AA]">Utakmica:</span>
                        <span className="text-sm font-bold text-white">{items.length}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-6 h-6 text-[#00E0FF]" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-[#A1A1AA]" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Group Content */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[#0D1117] border-b border-[#2C2C2F]">
                        <tr>
                          <th className="p-4 text-left text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              Utakmica
                            </div>
                          </th>
                          <th className="p-4 text-left text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Vrijeme
                            </div>
                          </th>
                          <th className="p-4 text-center text-xs font-bold text-[#A1A1AA] uppercase tracking-wider">
                            <div className="flex items-center justify-center gap-2">
                              <Target className="w-4 h-4" />
                              Rezultat
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2C2C2F]">
                        {items.map((m, idx) => {
                          const hasScore = Number.isFinite(m.score_a) && Number.isFinite(m.score_b);
                          return (
                            <tr 
                              key={m.id} 
                              className="hover:bg-[#0D1117] transition-colors duration-200 group"
                            >
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-[#00E0FF]/20 flex items-center justify-center text-[#00E0FF] font-bold text-sm">
                                    {idx + 1}
                                  </div>
                                  <div>
                                    <p className="text-white font-bold">
                                      {m.team_a?.name} 
                                      <span className="text-[#00E0FF] font-black mx-2">VS</span> 
                                      {m.team_b?.name}
                                    </p>
                                    {m.round && (
                                      <p className="text-xs text-[#666] mt-1">{m.round}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-[#666]" />
                                  <span className="text-[#A1A1AA] text-sm">
                                    {m.start_time 
                                      ? new Date(m.start_time).toLocaleString('hr-HR', {
                                          day: 'numeric',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })
                                      : '–'
                                    }
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex justify-center">
                                  {hasScore ? (
                                    <div className="flex items-center gap-3 px-4 py-2 bg-[#00E0FF]/20 border border-[#00E0FF]/40 rounded-xl">
                                      <span className="text-2xl font-black text-[#00E0FF] font-mono">
                                        {m.score_a}
                                      </span>
                                      <span className="text-[#666] font-bold">:</span>
                                      <span className="text-2xl font-black text-[#7C3AED] font-mono">
                                        {m.score_b}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[#666] italic">Bez rezultata</span>
                                  )}
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
            );
          })
        )}
      </div>
    </div>
  );
}
