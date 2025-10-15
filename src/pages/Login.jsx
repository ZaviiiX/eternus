import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/dashboard";

  const [form, setForm] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      await login(form);
      navigate(from, { replace: true });
    } catch (e) {
      setErr(e.message || "Neuspjela prijava. Provjeri podatke.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-[#0E0E10] text-[#FFFFFF] font-[Inter,sans-serif]">
      <form onSubmit={handleSubmit} className="bg-[#18181B] rounded-xl shadow p-6 w-full max-w-sm space-y-4 border border-transparent hover:border-[#bff47b] transition-all duration-200">
        <h1 className="text-2xl font-bold text-center text-[#bff47b]">Prijava</h1>
        {err && <p className="text-[#FF3B3B] text-sm">{err}</p>}

        <div>
          <label className="text-sm text-[#A1A1AA]">Email</label>
          <input
            type="email"
            className="w-full border border-[#1F1F23] bg-[#18181B] text-[#FFFFFF] rounded mt-1 p-2 focus:outline-none focus:border-[#bff47b]"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="text-sm text-[#A1A1AA]">Lozinka</label>
          <input
            type="password"
            className="w-full border border-[#1F1F23] bg-[#18181B] text-[#FFFFFF] rounded mt-1 p-2 focus:outline-none focus:border-[#bff47b]"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full border border-[#bff47b] bg-transparent text-[#bff47b] py-2 rounded-[10px] transition duration-200 hover:bg-[#bff47b] hover:text-[#0E0E10] disabled:opacity-60"
        >
          {submitting ? "Prijava..." : "Prijavi se"}
        </button>
      </form>
    </div>
  );
}
