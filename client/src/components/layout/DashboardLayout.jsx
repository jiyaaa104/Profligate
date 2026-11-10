import React, { useState } from "react";
import NotificationBell from "./NotificationBell";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  User,
  LogOut,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import api from "../../services/api";
import AppBackground from "../backgrounds/AppBackground";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Retrieve current user from localStorage
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("profligate_user")) || null;
    } catch {
      return null;
    }
  })();

  // Handle logout
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout request failed, clearing local state anyway:", err);
    } finally {
      localStorage.removeItem("profligate_user");
      setMobileMenuOpen(false);
      navigate("/login", { replace: true });
    }
  };

  const navItems = [
    { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    { label: "Transactions", to: "/transactions", icon: ArrowLeftRight },
    { label: "Budgets", to: "/budgets", icon: PieChart },
    { label: "Profile", to: "/profile", icon: User },
  ];

  return (
    <div className="min-h-screen text-slate-100 flex flex-col md:flex-row relative overflow-x-hidden">
      {/* Animated Micro Slats background (fixed, behind content) */}
      <AppBackground />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-white/5 p-6 shrink-0 justify-between sticky top-0 h-screen z-20">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-10 h-10 rounded-xl bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
              <ShieldCheck className="w-6 h-6 text-brand-emerald" />
            </div>

            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                Profligate
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-brand-emerald font-semibold block">
                Student Finance
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-brand-emerald/15 text-brand-emerald-light border border-brand-emerald/25 shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="border-t border-white/10 pt-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-3 truncate">
            <div className="w-9 h-9 rounded-full bg-brand-emerald/20 border border-brand-emerald/40 flex items-center justify-center text-brand-emerald font-bold text-sm shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>

            <div className="truncate">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || "Student User"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {user?.email || "student@university.edu"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden glass-panel border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
            <ShieldCheck className="w-5 h-5 text-brand-emerald" />
          </div>

          <span className="text-lg font-bold text-white">Profligate</span>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />

          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors"
            title="Log Out"
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>

          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="text-slate-300 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Dropdown Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="md:hidden glass-panel-glow border-b border-white/10 p-4 flex flex-col gap-2 z-20 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-emerald/15 text-brand-emerald-light border border-brand-emerald/25"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 glass-panel border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-sm font-medium text-slate-400">
              Welcome back,{" "}
              <span className="text-slate-100 font-semibold">
                {user?.name || "Student"}
              </span>
            </h2>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-4">
            <NotificationBell />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-white/5 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 border border-white/10 transition-all duration-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* Page Render Body */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
