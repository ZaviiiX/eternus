import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // supabase user
  const [profile, setProfile] = useState(null); // red iz public.admins (sport_id, role, ...)
  const [loading, setLoading] = useState(true);

  async function loadProfile(u) {
    if (!u) { setProfile(null); return; }
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .eq("user_id", u.id)
      .maybeSingle(); // nema 406 ako red ne postoji
    if (error) {
      console.warn("admins select error:", error.message);
      setProfile(null);
    } else {
      setProfile(data || null);
    }
  }

  useEffect(() => {
    let unsub = null;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.warn("getSession error:", error.message);
        const u = data?.session?.user ?? null;
        setUser(u);
        // pri inicijalnom loadu pričekaj dok se profil ne učita
        await loadProfile(u);
      } finally {
        setLoading(false); // 🔑 uvijek spusti loading
      }
    })();

    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      loadProfile(u);
    });
    unsub = sub?.data?.subscription;

    return () => unsub?.unsubscribe?.();
  }, []);

  const login = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    setUser(data.user);
    await loadProfile(data.user);
    return data;
  };

  const logout = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setUser(null);
    setProfile(null);
  };

  const value = useMemo(() => ({ user, profile, loading, login, logout }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
