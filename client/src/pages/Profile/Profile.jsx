import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Mail,
  Wallet,
  Globe,
  Clock,
  Bell,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import api from "../../services/api";

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "CAD", "AUD", "SGD"];

export default function Profile() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // 1. Fetch user profile from GET /users/me
  const { data: user, isLoading, isError, error } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const response = await api.get("/users/me");
      return response.data?.data;
    },
  });

  // Local form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    openingBalanceRupees: "0",
    currency: "INR",
    timezone: "Asia/Kolkata",
    dailyLimitRupees: "0",
    alertEnabled: true,
    aiInsightsEnabled: true,
  });

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        openingBalanceRupees: user.openingBalancePaise
          ? (user.openingBalancePaise / 100).toString()
          : "0",
        currency: user.currency || "INR",
        timezone: user.timezone || "Asia/Kolkata",
        dailyLimitRupees: user.preferences?.dailyLimitPaise
          ? (user.preferences.dailyLimitPaise / 100).toString()
          : "0",
        alertEnabled: user.preferences?.alertEnabled ?? true,
        aiInsightsEnabled: user.preferences?.aiInsightsEnabled ?? true,
      });
    }
  }, [user]);

  // 2. Mutation: Update profile via PATCH /users/me
  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.patch("/users/me", payload);
      return response.data?.data;
    },
    onSuccess: (updatedUser) => {
      // Invalidate queries so dashboard balance and user profile refresh
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });

      // Update localStorage with updated user info
      localStorage.setItem("profligate_user", JSON.stringify(updatedUser));

      setSuccessMessage("Profile and financial settings updated successfully!");
      setErrorMessage("");

      // Auto-hide success message after 4 seconds
      setTimeout(() => setSuccessMessage(""), 4000);
    },
    onError: (err) => {
      setErrorMessage(
        err.response?.data?.message ||
          "Failed to update profile. Please check your inputs."
      );
      setSuccessMessage("");
    },
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    if (errorMessage) setErrorMessage("");
    if (successMessage) setSuccessMessage("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Validate and convert Rupees to integer Paise
    const parsedOpeningBalance = parseFloat(formData.openingBalanceRupees);
    if (isNaN(parsedOpeningBalance) || parsedOpeningBalance < 0) {
      setErrorMessage("Opening balance must be a valid non-negative number.");
      return;
    }

    const parsedDailyLimit = parseFloat(formData.dailyLimitRupees);
    if (isNaN(parsedDailyLimit) || parsedDailyLimit < 0) {
      setErrorMessage("Daily spending limit must be a valid non-negative number.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      currency: formData.currency.trim().toUpperCase(),
      timezone: formData.timezone.trim(),
      openingBalancePaise: Math.round(parsedOpeningBalance * 100),
      preferences: {
        dailyLimitPaise: Math.round(parsedDailyLimit * 100),
        alertEnabled: formData.alertEnabled,
        aiInsightsEnabled: formData.aiInsightsEnabled,
      },
    };

    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-brand-emerald" />
        <p className="text-sm font-medium">Loading user profile...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl flex items-center gap-3">
        <AlertCircle className="w-6 h-6 shrink-0" />
        <p className="text-sm">
          {error?.response?.data?.message ||
            "Unable to retrieve profile. Please ensure you are logged in."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Profile & Preferences
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure your student profile, baseline opening balance, and smart spending alerts.
        </p>
      </div>

      {/* Notifications / Toast Messages */}
      {successMessage && (
        <div className="bg-brand-emerald/15 border border-brand-emerald/30 text-brand-emerald-light p-4 rounded-xl text-sm flex items-center gap-3 shadow-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-brand-emerald shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm flex items-center gap-3 shadow-sm animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal Info */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/5 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Personal Information</h2>
              <p className="text-xs text-slate-400">
                Identity details associated with your Profligate account.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald transition-colors"
              />
            </div>

            {/* Email Address (Read-only) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Email Address
                </label>
                <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3" />
                  Primary Identifier
                </span>
              </div>
              <input
                type="email"
                value={formData.email}
                readOnly
                disabled
                className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed select-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Financial Settings */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/5 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Financial Baseline Settings</h2>
              <p className="text-xs text-slate-400">
                Opening balance and localization preferences for calculating available student funds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Opening Balance (Rupees) */}
            <div className="sm:col-span-1">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                Opening Balance (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="openingBalanceRupees"
                  value={formData.openingBalanceRupees}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald font-mono font-semibold"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Recorded cash/bank amount as of starting date.
              </span>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <span>Currency</span>
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                required
                className="w-full bg-navy-850 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-emerald"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Timezone</span>
              </label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleInputChange}
                required
                className="w-full bg-navy-850 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-emerald"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Preferences & Alerts */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/5 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Alerts & AI Preferences</h2>
              <p className="text-xs text-slate-400">
                Rule-based smart alert thresholds and AI recommendations.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Daily Limit */}
            <div className="max-w-xs">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                Daily Spending Limit (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  name="dailyLimitRupees"
                  value={formData.dailyLimitRupees}
                  onChange={handleInputChange}
                  placeholder="500"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald font-mono font-semibold"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                0 means no daily spending limit set.
              </span>
            </div>

            {/* Toggle 1: Smart Spending Alerts */}
            <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Smart Spending & Budget Alerts
                  </h3>
                  <p className="text-xs text-slate-400">
                    Receive non-judgmental notifications when spending crosses 75%, 90%, or 100% of category budgets.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  name="alertEnabled"
                  checked={formData.alertEnabled}
                  onChange={handleInputChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-emerald"></div>
              </label>
            </div>

            {/* Toggle 2: AI Financial Insights */}
            <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-brand-emerald mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    AI Financial Insights & Recommendations
                  </h3>
                  <p className="text-xs text-slate-400">
                    Enable weekly habit observations and personalized saving tips powered by responsible AI.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  name="aiInsightsEnabled"
                  checked={formData.aiInsightsEnabled}
                  onChange={handleInputChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-emerald"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

