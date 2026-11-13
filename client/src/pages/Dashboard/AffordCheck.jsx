import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, Loader2, X } from "lucide-react";
import api from "../../services/api";
import { describePurchase } from "../../utils/runwayFormat";

const MAX_RUPEES = 10_000_000; // ₹1 crore, same limit as the API

const TONE_STYLES = {
  ok: "bg-brand-emerald/10 border-brand-emerald/25 text-brand-emerald-light",
  warn: "bg-amber-500/10 border-amber-500/30 text-amber-200",
  no: "bg-red-500/10 border-red-500/30 text-red-300",
};

/**
 * "Can I afford this?" — previews the runway as if an amount were spent
 * today. Nothing is saved.
 */
export default function AffordCheck({ runway }) {
  const [input, setInput] = useState("");
  const [amountPaise, setAmountPaise] = useState(null);
  const [inputError, setInputError] = useState("");

  // Nested under "dashboard-summary" so adding a transaction refreshes it.
  const preview = useQuery({
    queryKey: ["dashboard-summary", "runway", "preview", amountPaise],
    queryFn: async () => {
      const response = await api.get("/dashboard/runway", {
        params: { purchasePaise: amountPaise },
      });
      return response.data?.data;
    },
    enabled: amountPaise !== null,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const rupees = parseFloat(input);
    if (isNaN(rupees) || rupees <= 0) {
      setInputError("Enter an amount greater than ₹0.");
      return;
    }
    if (rupees > MAX_RUPEES) {
      setInputError("That's more than ₹1 crore. Try a smaller amount.");
      return;
    }
    setInputError("");
    setAmountPaise(Math.round(rupees * 100));
  };

  const clear = () => {
    setInput("");
    setAmountPaise(null);
    setInputError("");
  };

  const result =
    amountPaise !== null && preview.data?.status === "ready"
      ? describePurchase(runway, preview.data, amountPaise)
      : null;

  return (
    <div className="mt-5 pt-4 border-t border-white/5">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
      >
        <label
          htmlFor="afford-amount"
          className="text-sm font-semibold text-white flex items-center gap-2 shrink-0"
        >
          <Calculator className="w-4 h-4 text-brand-emerald" />
          Can I afford this?
        </label>
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
              ₹
            </span>
            <input
              id="afford-amount"
              type="number"
              min="1"
              step="any"
              inputMode="decimal"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (inputError) setInputError("");
              }}
              placeholder="1200"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald font-mono font-semibold"
            />
          </div>
          <button
            type="submit"
            disabled={preview.isFetching}
            className="bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            {preview.isFetching && <Loader2 className="w-4 h-4 animate-spin" />}
            Check
          </button>
          {amountPaise !== null && (
            <button
              type="button"
              onClick={clear}
              title="Clear"
              aria-label="Clear the amount"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {inputError && <p className="text-xs text-red-400 mt-2">{inputError}</p>}

      {preview.isError && (
        <p className="text-xs text-red-400 mt-2">
          {preview.error?.response?.data?.message ||
            "Couldn't check that right now. Please try again."}
        </p>
      )}

      {result && (
        <div
          className={`mt-3 rounded-xl border px-4 py-3 text-sm space-y-0.5 ${TONE_STYLES[result.tone]}`}
          aria-live="polite"
        >
          {result.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="text-xs text-slate-400 pt-1">
            Just a preview. Nothing is recorded.
          </p>
        </div>
      )}
    </div>
  );
}
