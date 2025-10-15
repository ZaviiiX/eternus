// src/pages/Dashboard/DashboardLayout.jsx
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Trophy,
  Home,
  ChevronRight,
  Sparkles,
  Settings,
  Bell,
  User,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

const menu = [
  { name: "Pregled", path: "/dashboard", icon: LayoutDashboard },
  { name: "Ekipe", path: "/dashboard/teams", icon: Users },
  { name: "Raspored", path: "/dashboard/schedule", icon: Calendar },
  { name: "Rezultati", path: "/dashboard/results", icon: BarChart3 },
  { name: "Tablica", path: "/dashboard/standings", icon: Trophy },
];

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeItem =
    menu.find((m) => m.path === location.pathname)?.name || "Pregled";

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#0D1117] to-[#0A0E27]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-72 bg-gradient-to-b from-[#18181B] to-[#0D1117]
          border-r border-[#00E0FF]/20 shadow-2xl
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        {/* Header */}
        <div className="p-6 border-b border-[#2C2C2F]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-[#00E0FF]/50">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  Dashboard
                </h2>
                <p className="text-xs text-[#A1A1AA]">Upravljačka ploča</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-[#2C2C2F] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#A1A1AA]" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="bg-gradient-to-r from-[#00E0FF]/10 to-[#7C3AED]/10 border border-[#00E0FF]/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#7C3AED] flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">
                  {profile?.name || user?.email || "Admin User"}
                </p>
                <p className="text-[#A1A1AA] text-xs">
                  {profile?.role || "Organizator"}
                </p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menu.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  group flex items-center gap-3 px-4 py-3 rounded-xl
                  transition-all duration-300 relative overflow-hidden
                  ${
                    isActive
                      ? "bg-gradient-to-r from-[#00E0FF] to-[#7C3AED] text-white shadow-lg shadow-[#00E0FF]/30"
                      : "text-[#A1A1AA] hover:bg-[#2C2C2F] hover:text-white"
                  }
                `}
              >
                <div
                  className={`
                    absolute inset-0 bg-gradient-to-r from-[#00E0FF]/20 to-[#7C3AED]/20
                    opacity-0 group-hover:opacity-100 transition-opacity duration-300
                    ${isActive ? "opacity-0" : ""}
                  `}
                />
                <Icon
                  className={`
                    w-5 h-5 z-10 transition-transform duration-300
                    ${isActive ? "scale-110" : "group-hover:scale-110"}
                  `}
                />
                <span className="font-semibold text-sm z-10">{item.name}</span>
                <ChevronRight
                  className={`
                    w-4 h-4 ml-auto z-10 transition-all duration-300
                    ${
                      isActive
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"
                    }
                  `}
                />
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Stats */}
        <div className="p-4 border-t border-[#2C2C2F]">
          <div className="bg-gradient-to-br from-[#2C2C2F] to-[#18181B] rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#00E0FF]" />
              <span className="text-xs font-bold text-[#00E0FF] uppercase tracking-wider">
                Današnji pregled
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#A1A1AA]">Utakmice danas</span>
                <span className="text-sm font-bold text-white">5</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#A1A1AA]">Live sada</span>
                <span className="text-sm font-bold text-red-400">2</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button className="w-full flex items-center gap-3 px-4 py-2 text-[#A1A1AA] hover:bg-[#2C2C2F] rounded-lg transition-colors text-sm">
              <Settings className="w-4 h-4" />
              <span>Postavke</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2 text-[#A1A1AA] hover:bg-[#2C2C2F] rounded-lg transition-colors text-sm">
              <Bell className="w-4 h-4" />
              <span>Obavijesti</span>
            </button>
          </div>
        </div>

        {/* Footer (sidebar) */}
        <div className="p-4 border-t border-[#2C2C2F]">
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2 text-[#A1A1AA] hover:text-white hover:bg-[#2C2C2F] rounded-lg transition-all group"
          >
            <Home className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Povratak</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 mt-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all group"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Odjava</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#18181B]/80 backdrop-blur-xl border-b border-[#2C2C2F] shadow-lg">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-[#2C2C2F] rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>

            {/* Breadcrumb */}
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <Home className="w-4 h-4 text-[#A1A1AA]" />
              <ChevronRight className="w-4 h-4 text-[#666]" />
              <span className="text-[#A1A1AA]">Dashboard</span>
              <ChevronRight className="w-4 h-4 text-[#666]" />
              <span className="text-white font-semibold">{activeItem}</span>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <button className="relative p-2 hover:bg-[#2C2C2F] rounded-lg transition-colors group">
                <Bell className="w-5 h-5 text-[#A1A1AA] group-hover:text-white transition-colors" />
                <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </button>

              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-[#2C2C2F] rounded-lg">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-xs font-medium text-white">Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-[#2C2C2F] bg-[#18181B]/50 backdrop-blur-xl">
          <div className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#666]">
              © 2026 Gerovski Sportski Dan. Sva prava pridržana.
            </p>
            <div className="flex items-center gap-4 text-xs text-[#666]">
              <a href="#" className="hover:text-[#00E0FF] transition-colors">
                Pomoć
              </a>
              <span>•</span>
              <a href="#" className="hover:text-[#00E0FF] transition-colors">
                Kontakt
              </a>
              <span>•</span>
              <a href="#" className="hover:text-[#00E0FF] transition-colors">
                Pravila
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
