import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw, AlertCircle, Loader2, Clock } from "lucide-react";
import api from "../../services/api";

const AIInsightsCard = () => {
  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["ai-insights"],

    queryFn: async () => {
      const response = await api.get("/ai/insights");

      const insights = response.data?.data?.insights;

      if (!Array.isArray(insights)) {
        throw new Error("Invalid AI insights response.");
      }

      return {
        insights: insights.filter(
          (insight) => typeof insight === "string" && insight.trim().length > 0,
        ),
        generatedAt: response.data?.data?.generatedAt || null,
        period: response.data?.data?.period || 30,
      };
    },

    // Avoid unnecessary Gemini API calls.
    staleTime: 5 * 60 * 1000,

    // Keep cached data for 30 minutes.
    gcTime: 30 * 60 * 1000,

    // Avoid automatic API calls on tab switching.
    refetchOnWindowFocus: false,

    // Do not retry disabled or failed AI requests automatically.
    retry: false,
  });

  const handleRefresh = () => {
    refetch();
  };

  const formatGeneratedTime = () => {
    if (!dataUpdatedAt) return null;

    return new Date(dataUpdatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const showInitialLoading = isPending && !data;
  const showError = isError && !data;

  return (
    <div className="glass-panel-glow rounded-2xl p-6 sm:p-8 border border-brand-emerald/20 relative overflow-hidden mt-6">
      {/* Background Glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-emerald/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">
              Profligate AI Insights
            </h2>

            <p className="text-xs text-slate-400">
              Smart recommendations based on your recent spending.
            </p>
          </div>
        </div>

        {/* Regenerate Button */}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching || showInitialLoading}
          aria-label="Regenerate AI insights"
          title="Regenerate Insights"
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              isFetching ? "animate-spin text-brand-emerald" : ""
            }`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Initial Loading */}
        {showInitialLoading ? (
          <div className="flex items-center gap-3 text-slate-400 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-brand-emerald shrink-0" />

            <p className="text-sm">Analyzing your spending habits...</p>
          </div>
        ) : showError ? (
          /* Initial Error */
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

            <div>
              <p className="text-sm">
                {error?.response?.data?.message ||
                  error?.message ||
                  "Could not load AI insights."}
              </p>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching}
                className="text-xs font-semibold mt-2 underline underline-offset-4 hover:text-red-300 disabled:opacity-50"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Background Refetch Error */}
            {isError && data && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-400 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

                <p className="text-xs">
                  Could not regenerate insights. Showing your previous
                  recommendations.
                </p>
              </div>
            )}

            {/* Insights */}
            {data?.insights?.length > 0 ? (
              <ul className="space-y-4">
                {data.insights.map((insight, index) => (
                  <li
                    key={`${index}-${insight}`}
                    className="flex items-start gap-3"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-emerald/20 text-brand-emerald text-xs font-bold shrink-0 mt-0.5">
                      {index + 1}
                    </span>

                    <p className="text-sm text-slate-300 leading-relaxed">
                      {insight}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-400 py-3">
                No insights available yet. Add some expenses to get personalized
                recommendations!
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between flex-wrap gap-2 mt-6 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />

                <span>
                  {dataUpdatedAt
                    ? `Last generated at ${formatGeneratedTime()}`
                    : "Recently generated"}
                </span>
              </div>

              {isFetching && (
                <span className="text-xs text-brand-emerald flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating insights...
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIInsightsCard;
