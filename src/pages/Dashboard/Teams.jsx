import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getTeamsBySport,
  createTeam,
  deleteTeam,
  getPlayers,
  addPlayer,
  removePlayer,
  supabase,
} from "../../services/api";
import {
  Users,
  UserPlus,
  Trash2,
  Plus,
  X,
  Shield,
  Award,
  AlertCircle,
  CheckCircle2,
  Search,
  Edit3,
  ChevronRight
} from "lucide-react";

export default function Teams() {
  const { profile, loading } = useAuth();
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // modali/toast
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  // modal: dodavanje ekipe + početni igrači
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTeam, setNewTeam] = useState("");
  const [newPlayers, setNewPlayers] = useState([{ first_name: "", last_name: "" }]);

  // dodavanje jednog igrača na postojeću ekipu
  const [pf, setPf] = useState({ first_name: "", last_name: "" });

  const sportId = profile?.sport_id;

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- LOADERS ---
  const loadTeams = async () => {
    if (!sportId) return;
    try {
      const data = await getTeamsBySport(sportId);
      setTeams(data);
    } catch (e) {
      console.error(e);
      showToast("Greška pri učitavanju ekipa", "error");
    }
  };

  const loadPlayers = async (teamId) => {
    try {
      const list = await getPlayers(teamId);
      setPlayers(list);
    } catch {
      showToast("Greška pri učitavanju igrača", "error");
    }
  };

  useEffect(() => {
    if (!loading) loadTeams();
  }, [loading, sportId]);

  useEffect(() => {
    if (!sportId) return;
    const ch = supabase
      .channel("teams_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `sport_id=eq.${sportId}` },
        () => loadTeams()
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [sportId]);

  const openPlayers = async (team) => {
    setActiveTeam(team);
    await loadPlayers(team.id);
  };

  // ========== DODAVANJE EKIPE (s igračima) ==========
  const handleAddTeam = async () => {
    const teamName = newTeam.trim();

    if (!teamName) return showToast("Upišite naziv ekipe", "error");

    const teamExists = teams.some(
      (t) => t.name.trim().toLowerCase() === teamName.toLowerCase()
    );
    if (teamExists) return showToast("Ekipa s tim imenom već postoji", "error");

    const validPlayers = newPlayers
      .map((p) => ({
        first_name: p.first_name.trim(),
        last_name: p.last_name.trim(),
      }))
      .filter((p) => p.first_name && p.last_name);

    if (validPlayers.length === 0)
      return showToast("Dodajte barem jednog igrača", "error");

    const hasDup = validPlayers.some((p, i) =>
      validPlayers.findIndex(
        (x) =>
          x.first_name.toLowerCase() === p.first_name.toLowerCase() &&
          x.last_name.toLowerCase() === p.last_name.toLowerCase()
      ) !== i
    );
    if (hasDup) return showToast("Isti igrač je već unesen u popisu", "error");

    setBusy(true);
    try {
      const team = await createTeam(sportId, teamName);
      for (const player of validPlayers) {
        await addPlayer(team.id, player.first_name, player.last_name);
      }

      setNewTeam("");
      setNewPlayers([{ first_name: "", last_name: "" }]);
      await loadTeams();
      setShowAddModal(false);
      showToast("Ekipa uspješno dodana!", "success");
    } catch (e) {
      console.error(e);
      showToast("Greška pri dodavanju ekipe", "error");
    } finally {
      setBusy(false);
    }
  };

  // ========== DODAVANJE IGRAČA NA POSTOJEĆU EKIPU ==========
  const handleAddPlayerToActive = async () => {
    if (!activeTeam) return;

    const first = pf.first_name.trim();
    const last = pf.last_name.trim();
    if (!first || !last) return showToast("Upišite ime i prezime igrača", "error");

    const dup = players.some(
      (p) =>
        p.first_name.trim().toLowerCase() === first.toLowerCase() &&
        p.last_name.trim().toLowerCase() === last.toLowerCase()
    );
    if (dup) return showToast("Igrač s istim imenom i prezimenom već postoji", "error");

    setBusy(true);
    try {
      await addPlayer(activeTeam.id, first, last);
      await loadPlayers(activeTeam.id);
      setPf({ first_name: "", last_name: "" });
      showToast("Igrač dodan!", "success");
    } catch (e) {
      console.error(e);
      showToast("Greška pri dodavanju igrača", "error");
    } finally {
      setBusy(false);
    }
  };

  // ========== BRISANJE EKIPE / IGRAČA ==========
  const onDeleteTeam = async (team) => {
    setModal({
      message: `Jeste li sigurni da želite izbrisati ekipu "${team.name}"?`,
      type: "danger",
      onConfirm: async () => {
        setBusy(true);
        try {
          await deleteTeam(team.id);
          if (activeTeam?.id === team.id) {
            setActiveTeam(null);
            setPlayers([]);
          }
          await loadTeams();
          showToast("Ekipa obrisana!", "success");
        } catch {
          showToast("Greška pri brisanju ekipe", "error");
        } finally {
          setBusy(false);
          setModal(null);
        }
      },
    });
  };

  const onRemovePlayer = async (player) => {
    const fullName = `${player.first_name} ${player.last_name}`;
    setModal({
      message: `Jeste li sigurni da želite izbrisati igrača "${fullName}"?`,
      type: "danger",
      onConfirm: async () => {
        setBusy(true);
        try {
          await removePlayer(player.id);
          await loadPlayers(activeTeam.id);
          showToast("Igrač obrisan!", "success");
        } catch {
          showToast("Greška pri brisanju igrača", "error");
        } finally {
          setBusy(false);
          setModal(null);
        }
      },
    });
  };

  const addPlayerField = () =>
    setNewPlayers((p) => [...p, { first_name: "", last_name: "" }]);
  const removePlayerField = (index) =>
    setNewPlayers((prev) => prev.filter((_, i) => i !== index));

  // Filter teams
  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- UI ---
  if (loading) return null;
  if (!sportId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-[#666] mx-auto mb-4" />
          <p className="text-[#A1A1AA] text-lg">Nemate pridružen sport.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27] text-white p-6 relative">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center">
                <Users className="w-7 h-7 text-white" />
              </div>
              Upravljanje ekipama
            </h1>
            <p className="text-[#A1A1AA]">Dodajte i upravljajte ekipama i igračima</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] text-black font-bold px-6 py-3 rounded-xl hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] transition-all duration-300 hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Dodaj ekipu
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-[#00E0FF]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#00E0FF]/20">
                <Shield className="w-5 h-5 text-[#00E0FF]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Ukupno ekipa</span>
            </div>
            <p className="text-3xl font-black">{teams.length}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-[#7C3AED]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#7C3AED]/20">
                <Users className="w-5 h-5 text-[#7C3AED]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Aktivna ekipa</span>
            </div>
            <p className="text-2xl font-black truncate">{activeTeam?.name || "Nijedna"}</p>
          </div>

          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] border border-[#2C2C2F] rounded-xl p-5 hover:border-[#EC4899]/40 transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#EC4899]/20">
                <Award className="w-5 h-5 text-[#EC4899]" />
              </div>
              <span className="text-[#A1A1AA] text-sm font-medium">Igrači u ekipi</span>
            </div>
            <p className="text-3xl font-black">{players.length}</p>
          </div>
        </div>
      </div>

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

      {/* Confirm Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] p-8 rounded-2xl shadow-2xl border border-[#2C2C2F] max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-red-500/20">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Potvrda brisanja</h3>
            </div>
            <p className="text-[#A1A1AA] mb-6">{modal.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="px-5 py-2.5 rounded-xl border-2 border-[#2C2C2F] hover:bg-[#2C2C2F] transition-all font-semibold"
              >
                Odustani
              </button>
              <button
                onClick={modal.onConfirm}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold transition-all hover:scale-105"
              >
                Potvrdi brisanje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl shadow-2xl border border-[#00E0FF]/20 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-[#00E0FF] to-[#7C3AED] p-6 border-b border-[#00E0FF]/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-black text-white">Dodaj novu ekipu</h2>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-white mb-2">Naziv ekipe</label>
                <input
                  type="text"
                  placeholder="Unesite naziv ekipe"
                  className="bg-[#0D1117] border-2 border-[#2C2C2F] rounded-xl px-4 py-3 w-full text-white placeholder-[#666] focus:ring-2 focus:ring-[#00E0FF] focus:border-[#00E0FF] transition-all"
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold text-white">Igrači</label>
                  <button
                    onClick={addPlayerField}
                    type="button"
                    className="flex items-center gap-2 text-[#00E0FF] hover:text-[#00BBD4] text-sm font-semibold transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj igrača
                  </button>
                </div>

                <div className="space-y-3">
                  {newPlayers.map((player, idx) => (
                    <div key={idx} className="flex gap-3 items-center p-3 bg-[#0D1117] border border-[#2C2C2F] rounded-xl">
                      <span className="w-8 h-8 rounded-lg bg-[#00E0FF]/20 flex items-center justify-center text-[#00E0FF] font-bold text-sm">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Ime"
                        className="bg-[#18181B] border border-[#2C2C2F] rounded-lg px-3 py-2 flex-1 text-white placeholder-[#666] focus:ring-2 focus:ring-[#00E0FF] transition-all"
                        value={player.first_name}
                        onChange={(e) =>
                          setNewPlayers((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, first_name: e.target.value } : p
                            )
                          )
                        }
                      />
                      <input
                        type="text"
                        placeholder="Prezime"
                        className="bg-[#18181B] border border-[#2C2C2F] rounded-lg px-3 py-2 flex-1 text-white placeholder-[#666] focus:ring-2 focus:ring-[#00E0FF] transition-all"
                        value={player.last_name}
                        onChange={(e) =>
                          setNewPlayers((prev) =>
                            prev.map((p, i) =>
                              i === idx ? { ...p, last_name: e.target.value } : p
                            )
                          )
                        }
                      />
                      {newPlayers.length > 1 && (
                        <button
                          onClick={() => removePlayerField(idx)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          type="button"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#2C2C2F]">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 rounded-xl border-2 border-[#2C2C2F] hover:bg-[#2C2C2F] transition-all font-semibold"
                >
                  Odustani
                </button>
                <button
                  onClick={handleAddTeam}
                  disabled={busy}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] text-black font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105"
                >
                  {busy ? "Spremanje..." : "Spremi ekipu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teams list + Players */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Ekipe - 2 kolone */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl shadow-xl border border-[#2C2C2F] overflow-hidden">
          <div className="p-6 border-b border-[#2C2C2F] bg-gradient-to-r from-[#00E0FF]/5 to-transparent">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#00E0FF]" />
              Sve ekipe ({filteredTeams.length})
            </h2>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666]" />
              <input
                type="text"
                placeholder="Pretraži ekipe..."
                className="w-full pl-10 pr-4 py-3 bg-[#0D1117] border border-[#2C2C2F] rounded-xl text-white placeholder-[#666] focus:ring-2 focus:ring-[#00E0FF] focus:border-[#00E0FF] transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[600px]">
            {filteredTeams.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-16 h-16 text-[#666] mx-auto mb-4" />
                <p className="text-[#A1A1AA]">
                  {searchQuery ? "Nema rezultata pretrage" : "Nema ekipa. Dodaj prvu ekipu."}
                </p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {filteredTeams.map((t) => (
                  <div
                    key={t.id}
                    className={`group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                      activeTeam?.id === t.id
                        ? "bg-gradient-to-r from-[#00E0FF] to-[#7C3AED] text-white shadow-lg shadow-[#00E0FF]/30"
                        : "bg-[#0D1117] border border-[#2C2C2F] hover:border-[#00E0FF]/40 hover:bg-[#18181B]"
                    }`}
                  >
                    <div 
                      onClick={() => openPlayers(t)} 
                      className="flex items-center gap-3 flex-1"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                        activeTeam?.id === t.id 
                          ? "bg-white/20 text-white" 
                          : "bg-[#00E0FF]/20 text-[#00E0FF]"
                      }`}>
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{t.name}</p>
                        <p className={`text-xs ${
                          activeTeam?.id === t.id ? "text-white/70" : "text-[#666]"
                        }`}>
                          Klikni za detalje
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform ${
                        activeTeam?.id === t.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                      }`} />
                    </div>
                    <button
                      onClick={() => onDeleteTeam(t)}
                      className={`ml-3 p-2 rounded-lg transition-all ${
                        activeTeam?.id === t.id
                          ? "hover:bg-white/20 text-white"
                          : "hover:bg-red-500/20 text-red-400"
                      }`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Igrači - 3 kolone */}
        <div className="lg:col-span-3 bg-gradient-to-br from-[#18181B] to-[#0D1117] rounded-2xl shadow-xl border border-[#2C2C2F] overflow-hidden">
          {activeTeam ? (
            <>
              <div className="p-6 border-b border-[#2C2C2F] bg-gradient-to-r from-[#7C3AED]/5 to-transparent">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
                      <Users className="w-7 h-7 text-[#7C3AED]" />
                      {activeTeam.name}
                    </h3>
                    <p className="text-[#A1A1AA] text-sm">{players.length} igrača</p>
                  </div>
                </div>

                {/* Forma za dodavanje igrača */}
                <div className="bg-[#0D1117] border border-[#2C2C2F] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <UserPlus className="w-5 h-5 text-[#00E0FF]" />
                    <span className="text-sm font-bold text-white">Dodaj novog igrača</span>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Ime"
                      className="bg-[#18181B] border border-[#2C2C2F] rounded-lg px-4 py-3 flex-1 text-white placeholder-[#666] focus:ring-2 focus:ring-[#00E0FF] transition-all"
                      value={pf.first_name}
                      onChange={(e) => setPf((p) => ({ ...p, first_name: e.target.value }))}
                    />
                    <input
                      type="text"
                      placeholder="Prezime"
                      className="bg-[#18181B] border border-[#2C2C2F] rounded-lg px-4 py-3 flex-1 text-white placeholder-[#666] focus:ring-2 focus:ring-[#00E0FF] transition-all"
                      value={pf.last_name}
                      onChange={(e) => setPf((p) => ({ ...p, last_name: e.target.value }))}
                    />
                    <button
                      onClick={handleAddPlayerToActive}
                      disabled={busy}
                      className="px-6 py-3 rounded-lg bg-gradient-to-r from-[#00E0FF] to-[#00B8CC] hover:shadow-[0_0_20px_rgba(0,224,255,0.4)] text-black font-bold transition-all disabled:opacity-60 hover:scale-105"
                    >
                      Dodaj
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[500px]">
                {players.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3">
                    {players.map((p, idx) => (
                      <div
                        key={p.id}
                        className="group flex items-center justify-between p-4 border border-[#2C2C2F] rounded-xl bg-[#0D1117] hover:bg-[#18181B] hover:border-[#00E0FF]/40 transition-all duration-300"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center font-bold text-white text-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-xs text-[#666]">Igrač</p>
                          </div>
                        </div>
                        <button
                          onClick={() => onRemovePlayer(p)}
                          className="ml-3 p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-[#666] mx-auto mb-4" />
                    <p className="text-[#A1A1AA]">Nema igrača u ovoj ekipi.</p>
                    <p className="text-[#666] text-sm mt-2">Dodaj prvog igrača koristeći formu iznad</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full p-12">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#00E0FF]/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-[#00E0FF]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Odaberi ekipu</h3>
                <p className="text-[#A1A1AA] max-w-sm">
                  Klikni na ekipu s lijeve strane za pregled i upravljanje igračima
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}