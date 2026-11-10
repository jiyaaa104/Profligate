import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  PieChart,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  TrendingDown,
  Wallet,
  ShieldCheck,
  Calendar,
} from "lucide-react";
import api from "../../services/api";
import { formatINR } from "../../utils/formatters";

const BUDGET_CATEGORIES = [
  "Overall",
  "Food",
  "Shopping",
  "Transport",
  "Education",
  "Accommodation",
  "Entertainment",
  "Health",
  "Subscriptions",
  "Personal Care",
  "Travel",
  "Other",
];

export default function Budgets() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const getCurrentMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const initialFormState = {
    category: "Food",
    limit: "",
    month: selectedMonth,
  };

  const [formData, setFormData] = useState(initialFormState);

  // 1. Fetch budgets for the selected month
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["budgets", selectedMonth],
    queryFn: async () => {
      const response = await api.get(`/budgets?month=${selectedMonth}`);
      return response.data?.data;
    },
  });

  const budgets = data?.budgets || [];
  const totalBudgetedPaise = data?.totalBudgetedPaise || 0;
  const totalSpentPaise = data?.totalSpentPaise || 0;

  const overallUtilisation =
    totalBudgetedPaise > 0
      ? Number(((totalSpentPaise / totalBudgetedPaise) * 100).toFixed(1))
      : 0;

  const overallRemainingPaise = Math.max(0, totalBudgetedPaise - totalSpentPaise);
  const isOverallExceeded = totalSpentPaise > totalBudgetedPaise;

  // 2. Mutation: Create Budget
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post("/budgets", payload);
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["budgets"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);

      setIsModalOpen(false);
      setFormData(initialFormState);
      setFormError("");
    },
    onError: (err) => {
      setFormError(
        err.response?.data?.message ||
          "Failed to create budget. Please verify input.",
      );
    },
  });

  // 3. Mutation: Delete Budget
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/budgets/${id}`);
      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["budgets"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
    },
    onError: (err) => {
      alert(
        err.response?.data?.message ||
          "Failed to delete budget. Please try again.",
      );
    },
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    const parsedLimit = parseFloat(formData.limit);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      setFormError("Please enter a valid budget limit greater than 0.");
      return;
    }

    const limitPaise = Math.round(parsedLimit * 100);

    createMutation.mutate({
      category: formData.category.trim(),
      limitPaise,
      month: formData.month || selectedMonth,
    });
  };

  const handleDelete = (id, category) => {
    if (
      window.confirm(
        `Are you sure you want to delete the budget for "${category}"?`
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  const getProgressColor = (percentage, isExceeded) => {
    if (isExceeded || percentage > 100) return "bg-rose-500";
    if (percentage >= 75) return "bg-amber-500";
    return "bg-brand-emerald";
  };

  const getStatusBadge = (percentage, isExceeded, remainingPaise, limitPaise, spentPaise) => {
    if (isExceeded || percentage > 100) {
      const overPaise = spentPaise - limitPaise;
      return (
        <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-400 border border-rose-500/25 px-2.5 py-1 rounded-md text-xs font-semibold">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Exceeded by {formatINR(overPaise)}</span>
        </span>
      );
    }

    if (percentage >= 75) {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-md text-xs font-semibold">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{formatINR(remainingPaise)} remaining ({100 - percentage}% left)</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 bg-brand-emerald/15 text-brand-emerald-light border border-brand-emerald/25 px-2.5 py-1 rounded-md text-xs font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5 text-brand-emerald" />
        <span>{formatINR(remainingPaise)} left</span>
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Budgets & Limits
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Set monthly spending caps per category to prevent overspending.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month picker */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs sm:text-sm text-slate-300">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => {
              setFormData({ ...initialFormState, month: selectedMonth });
              setFormError("");
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Budget</span>
          </button>
        </div>
      </div>

      {/* Top Master Summary Card */}
      <div className="glass-panel-glow rounded-2xl p-6 sm:p-8 relative overflow-hidden border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Monthly Budget Progress ({selectedMonth})
            </span>
            <div className="flex items-baseline gap-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {formatINR(totalSpentPaise)}
              </h2>
              <span className="text-sm sm:text-base text-slate-400 font-medium">
                spent of {formatINR(totalBudgetedPaise)} budgeted
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Utilisation
              </p>
              <p
                className={`text-2xl font-extrabold font-mono ${isOverallExceeded
                    ? "text-rose-400"
                    : overallUtilisation >= 75
                      ? "text-amber-400"
                      : "text-brand-emerald-light"
                  }`}
              >
                {overallUtilisation}%
              </p>
            </div>
          </div>
        </div>

        {/* Master Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                overallUtilisation,
                isOverallExceeded
              )}`}
              style={{
                width: `${Math.min(Math.max(overallUtilisation, 0), 100)}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>0%</span>
            <span>
              {isOverallExceeded ? (
                <span className="text-rose-400 font-semibold">
                  Overall Budget Exceeded by {formatINR(totalSpentPaise - totalBudgetedPaise)}
                </span>
              ) : (
                <span className="text-slate-300">
                  {formatINR(overallRemainingPaise)} available across all budgets
                </span>
              )}
            </span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Individual Category Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-brand-emerald" />
            <span>Category Limits</span>
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {budgets.length} {budgets.length === 1 ? "budget" : "budgets"} active
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 glass-panel rounded-2xl">
            <Loader2 className="w-7 h-7 animate-spin text-brand-emerald" />
            <p className="text-sm">Loading category budgets...</p>
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-red-400 glass-panel rounded-2xl flex flex-col items-center gap-2 border border-red-500/20">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm">
              {error?.response?.data?.message || "Failed to load budgets."}
            </p>
          </div>
        ) : budgets.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3 px-4 glass-panel rounded-2xl border-white/5">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
              <PieChart className="w-7 h-7 text-slate-500" />
            </div>
            <h4 className="text-base font-bold text-slate-200">
              No budgets set for {selectedMonth}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Creating category budgets helps you keep spending in check before allowances run low.
            </p>
            <button
              onClick={() => {
                setFormData({ ...initialFormState, month: selectedMonth });
                setIsModalOpen(true);
              }}
              className="mt-2 text-xs font-semibold bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 px-4 py-2.5 rounded-lg transition-colors"
            >
              + Create First Budget
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {budgets.map((b) => {
              const percentage = b.utilisationPercentage || 0;
              const isExceeded = b.isExceeded;

              return (
                <div
                  key={b._id}
                  className="glass-panel rounded-2xl p-6 border-white/5 relative flex flex-col justify-between hover:border-white/10 transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                          Category
                        </span>
                        <h4 className="text-xl font-extrabold text-white capitalize mt-0.5">
                          {b.category}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleDelete(b._id, b.category)}
                        disabled={deleteMutation.isPending}
                        title="Delete budget"
                        className="text-slate-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors opacity-70 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <p className="text-xs text-slate-400">Spent</p>
                        <p className="text-lg font-bold text-slate-100 font-mono">
                          {formatINR(b.spentPaise)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-400">Cap Limit</p>
                        <p className="text-lg font-bold text-slate-300 font-mono">
                          {formatINR(b.limitPaise)}
                        </p>
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5 mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
                          percentage,
                          isExceeded
                        )}`}
                        style={{
                          width: `${Math.min(Math.max(percentage, 0), 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <div>
                      {getStatusBadge(
                        percentage,
                        isExceeded,
                        b.remainingPaise,
                        b.limitPaise,
                        b.spentPaise
                      )}
                    </div>
                    <span className="font-mono font-bold text-slate-300">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add Budget */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-panel-glow rounded-2xl p-6 sm:p-8 border border-white/10 text-slate-100 relative shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-brand-emerald" />
                <span>Create Category Budget</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs sm:text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-navy-850 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-emerald"
                >
                  {BUDGET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                  Monthly Cap Limit (₹ in Rupees)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    name="limit"
                    value={formData.limit}
                    onChange={handleInputChange}
                    placeholder="3000"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                  Budget Month
                </label>
                <input
                  type="month"
                  name="month"
                  value={formData.month}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-navy-850 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-emerald"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Set Budget</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}