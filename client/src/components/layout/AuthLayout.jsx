import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

/**
 * AuthLayout — Reusable glassmorphic auth container
 * Extracted from Streakies login.html visual pattern, adapted for Profligate
 * with a dark navy backdrop, subtle glow, and emerald branding.
 */
export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-navy-900">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-emerald/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-slate-800/40 rounded-full blur-[100px] pointer-events-none" />

      {/* Glass card panel */}
      <div className="relative z-10 w-full max-w-[420px] glass-panel-glow rounded-2xl p-8 sm:p-10 text-center">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-xl bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
            <ShieldCheck className="w-6 h-6 text-brand-emerald" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Profligate
          </h1>
        </div>

        <p className="text-xs uppercase tracking-widest text-brand-emerald font-semibold mb-4">
          Spend consciously. Save intentionally.
        </p>

        {subtitle && (
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {subtitle}
          </p>
        )}

        {/* Auth form content */}
        {children}
      </div>
    </div>
  );
}

