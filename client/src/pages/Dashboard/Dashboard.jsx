import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import AIInsightsCard from "./AIInsightsCard";
import RunwayCard from "./RunwayCard";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  AlertCircle,
  Loader2,
  Calendar,
  CreditCard,
  PlusCircle,
  LogOut,
} from "lucide-react";
import api from "../../services/api";
import { formatINR, formatDate } from "../../utils/formatters";

export default function Dashboard() {
  const navigate = useNavigate();

  // 1. Fetch dashboard summary using TanStack Query
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const response = await api.get("/dashboard/summary");
      return response.data?.data;
    },
  });

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      localStorage.removeItem("profligate_user");
      navigate("/login");
    }
  };

  const summary = data?.summary || {
    currentBalancePaise: 0,
    totalIncomePaise: 0,
    totalExpensePaise: 0,
    openingBalancePaise: 0,
  };

  const recentTransactions = data?.recentTransactions || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Page Title & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Financial Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track allowances, monitor expenses, and maintain spending control.
          </p>
        </div>

        {/* Quick action controls & Logout */}
        <div className="flex items-center gap-3">
          <Link
            to="/transactions"
            className="flex items-center gap-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Transaction</span>
          </Link>

          {/* Quick logout button on dashboard view */}
          <button
            onClick={handleLogout}
            title="Log Out"
            className="sm:hidden flex items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">
              {error?.response?.data?.message ||
                "Failed to load financial summary. Please ensure you are logged in."}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs font-semibold underline hover:text-red-300 shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

      <RunwayCard />

      {/* Summary Cards Grid (Total Balance, Total Income, Total Expense) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Available Recorded Balance */}
        <div className="glass-panel-glow rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Current Balance
            </span>
            <div className="w-10 h-10 rounded-xl bg-brand-emerald/15 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div>
            {isLoading ? (
              <div className="h-9 w-36 bg-white/5 animate-pulse rounded-lg my-1" />
            ) : (
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {formatINR(summary.currentBalancePaise)}
              </h2>
            )}
            <p className="text-xs text-brand-emerald-light flex items-center gap-1 mt-2">
              <span className="inline-block w-2 h-2 rounded-full bg-brand-emerald animate-ping" />
              Recorded student balance
            </p>
          </div>
        </div>

        {/* Card 2: Total Income */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border-white/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Income
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div>
            {isLoading ? (
              <div className="h-9 w-36 bg-white/5 animate-pulse rounded-lg my-1" />
            ) : (
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                {formatINR(summary.totalIncomePaise)}
              </h2>
            )}
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              Allowance & earnings
            </p>
          </div>
        </div>

        {/* Card 3: Total Expenses */}
        <div className="glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between border-white/5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Expenses
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>

          <div>
            {isLoading ? (
              <div className="h-9 w-36 bg-white/5 animate-pulse rounded-lg my-1" />
            ) : (
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                {formatINR(summary.totalExpensePaise)}
              </h2>
            )}
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
              Recorded expenditures
            </p>
          </div>
        </div>
      </div>
      <AIInsightsCard />
      {/* Recent Transactions Section */}
      <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Recent Transactions
              </h3>
              <p className="text-xs text-slate-400">
                Latest income and spending records
              </p>
            </div>
          </div>

          <Link
            to="/transactions"
            className="text-xs font-semibold text-brand-emerald hover:text-brand-emerald-light transition-colors flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Transactions List */}
        <div className="p-4 sm:p-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-emerald" />
              <p className="text-sm">Loading transactions...</p>
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                <Receipt className="w-6 h-6 text-slate-500" />
              </div>
              <h4 className="text-base font-semibold text-slate-200">
                No transactions yet
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                You haven't recorded any expenses or allowances yet. Click below
                to record your first transaction!
              </p>
              <Link
                to="/transactions"
                className="mt-2 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-lg transition-colors border border-white/10"
              >
                + Add First Transaction
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentTransactions.map((tx) => {
                const isIncome = tx.type === "income";

                return (
                  <div
                    key={tx._id}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4 hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
                  >
                    {/* Left: icon & details */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isIncome
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}
                      >
                        {isIncome ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate">
                          {tx.description || tx.category}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="capitalize font-medium text-slate-300">
                            {tx.category}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(tx.transactionDate)}
                          </span>
                          {tx.paymentMethod && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-[11px] bg-white/5 px-1.5 py-0.5 rounded text-slate-300">
                                <CreditCard className="w-3 h-3" />
                                {tx.paymentMethod}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: amount */}
                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm sm:text-base font-bold font-mono ${
                          isIncome ? "text-emerald-400" : "text-slate-100"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatINR(tx.amountPaise)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

