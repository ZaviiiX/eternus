// src/router/AppRouter.jsx
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* -------- PUBLIC pages -------- */
import Home from "../pages/Home";
import Sport from "../pages/Sport";
import ActiveMatch from "../pages/Dashboard/ActiveMatch"; // ⬅️ uvezemo JEDNOM i koristimo za obje rute
import Login from "../pages/Login";

/* -------- DASHBOARD layout + pages -------- */
import DashboardLayout from "../pages/Dashboard/DashboardLayout";
import DashboardHome from "../pages/Dashboard/DashboardHome"; // ako ga koristiš
import Schedule from "../pages/Dashboard/Schedule";
import Teams from "../pages/Dashboard/Teams";
import Results from "../pages/Dashboard/Results";
import Standings from "../pages/Dashboard/Standings";

/* ------------ Guards ------------ */
function RequireAuth({ children }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  return children;
}

/** Ako korisnik NIJE admin (nema pravo upravljanja),
 * preusmjeri /dashboard/match/:id na /active-match/:id
 */
function DashboardMatchGuard({ children }) {
  const { profile, loading } = useAuth();
  const { id } = useParams();
  if (loading) return null;

  const canManage = Boolean(
    profile?.role === "admin" ||
    profile?.role === "sport_admin" ||
    profile?.sport_id
  );

  if (!canManage) {
    return <Navigate to={`/active-match/${id}`} replace />;
  }
  return children;
}

function NotFound() {
  return <Navigate to="/" replace />;
}

/* ------------ Routes-only (BEZ <BrowserRouter>) ------------ */
export default function AppRouter() {
  return (
    <Routes>
      {/* PUBLIC */}
      <Route path="/" element={<Home />} />
      <Route path="/sport/:id" element={<Sport />} />
      <Route path="/active-match/:id" element={<ActiveMatch />} />
      <Route path="/login" element={<Login />} />

      {/* DASHBOARD (admin only) — nested da se rendera DashboardLayout + <Outlet /> */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        {/* index: ako imaš DashboardHome stavi ga, inače redirect na schedule */}
        <Route index element={DashboardHome ? <DashboardHome /> : <Navigate to="schedule" replace />} />

        <Route path="schedule" element={<Schedule />} />
        <Route path="teams" element={Teams ? <Teams /> : <Navigate to="schedule" replace />} />
        <Route path="results" element={Results ? <Results /> : <Navigate to="schedule" replace />} />
        <Route path="standings" element={Standings ? <Standings /> : <Navigate to="schedule" replace />} />

        {/* Admin “Upravljaj” pogled za pojedinačni meč */}
        <Route
          path="match/:id"
          element={
            <DashboardMatchGuard>
              <ActiveMatch />
            </DashboardMatchGuard>
          }
        />

        {/* fallback unutar dashboarda */}
        <Route path="*" element={<Navigate to="schedule" replace />} />
      </Route>

      {/* GLOBAL 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
