import { useEffect, useState } from "react";
import { supabase, SUPABASE_AVAILABLE } from "../services/api";

export default function DebugSupabase() {
  const [ok, setOk] = useState(null);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      if (!SUPABASE_AVAILABLE) {
        setOk(false);
        setError("SUPABASE_AVAILABLE is false (env vars missing)");
        return;
      }
      try {
        const { data, error } = await supabase.from("teams").select("id,name").limit(3);
        if (error) {
          setOk(false);
          setError(error.message || String(error));
        } else {
          setOk(true);
          setRows(data || []);
        }
      } catch (e) {
        setOk(false);
        setError(e.message || String(e));
      }
    })();
  }, []);

  return (
    <div className="p-6 min-h-screen bg-[#0E0E10] text-white font-inter">
      <h1 className="text-2xl font-bold mb-4">Supabase debug</h1>
      <p className="mb-2">SUPABASE_AVAILABLE: {String(!!SUPABASE_AVAILABLE)}</p>
      {ok === null && <p>Probing...</p>}
      {ok === false && (
        <div className="p-4 bg-[#18181B] rounded-xl border border-[#1F1F23]">
          <p className="text-red-400">Connection failed</p>
          <pre className="text-sm mt-2 text-[#A1A1AA]">{error}</pre>
        </div>
      )}
      {ok === true && (
        <div className="mt-4">
          <p className="text-green-400">Connected — sample rows:</p>
          <ul className="mt-2 space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="bg-[#18181B] p-2 rounded-xl border border-[#1F1F23]">{r.id}: {r.name}</li>
            ))}
            {rows.length === 0 && <li className="text-[#A1A1AA]">No rows returned.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
