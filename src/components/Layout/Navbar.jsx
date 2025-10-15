import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Menu, X, LogOut, User, LayoutDashboard, Home, LogIn } from "lucide-react";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // (po želji) sakrij navbar na dashboard sekciji
  const hideOnDashboard = pathname.startsWith("/dashboard");
  if (hideOnDashboard) return null;

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const baseLink =
    "text-sm font-medium px-3 py-2 rounded-lg transition-colors";
  const inactive =
    "text-[#A1A1AA] hover:text-white hover:bg-[#2C2C2F]";
  const active =
    "text-white bg-[#2C2C2F]";

  return (
    <header className="sticky top-0 z-40 border-b border-[#1F1F23] bg-[#18181B]/90 backdrop-blur-xl">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#bff47b] to-[#8fbe5b] flex items-center justify-center shadow-lg ">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-extrabold tracking-tight text-lg">
              Bijeli miš
            </span>
          </Link>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `${baseLink} ${isActive ? active : inactive}`
            }
          >
            Početna
          </NavLink>

          {!loading && user ? (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `${baseLink} flex items-center gap-1 ${isActive ? active : inactive}`
                }
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </NavLink>

              <button
                onClick={handleLogout}
                className="ml-2 inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                title="Odjava"
              >
                <LogOut className="w-4 h-4" />
                Odjava
              </button>

              <div className="ml-2 hidden lg:flex items-center gap-2 px-3 py-2 bg-[#2C2C2F] rounded-lg">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#bff47b] to-[#8fbe5b] flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-white truncate max-w-[140px]">
                  {user.email}
                </span>
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-[#bff47b] text-black hover:bg-[#8fbe5b] transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Prijava
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-[#2C2C2F] transition-colors"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Menu className="w-6 h-6 text-white" />
          )}
        </button>
      </nav>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t border-[#1F1F23] bg-[#18181B]">
          <div className="px-4 py-3 flex flex-col gap-2">
            <NavLink
              to="/"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `${baseLink} ${isActive ? active : inactive}`
              }
            >
              Početna
            </NavLink>

            {!loading && user ? (
              <>
                <NavLink
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `${baseLink} flex items-center gap-2 ${isActive ? active : inactive}`
                  }
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </NavLink>

                <button
                  onClick={() => {
                    setOpen(false);
                    handleLogout();
                  }}
                  className="mt-1 inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Odjava
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg bg-[#bff47b] text-black hover:bg-[#8fbe5b] transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Prijava
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
