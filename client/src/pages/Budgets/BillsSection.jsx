import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import api from "../../services/api";
import { formatINR } from "../../utils/formatters";
import { getApiErrorMessage } from "../../utils/apiErrors";
import { formatDay } from "../../utils/runwayFormat";

const BILL_CATEGORIES = [
  "Accommodation",
  "Subscriptions",
  "Education",
  "Transport",
  "Health",
  "Food",
  "Personal Care",
  "Other",
];

const EMPTY_FORM = { name: "", amount: "", dueDay: "", category: "Accommodation" };

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald";

/**
 * Monthly bills (rent, phone, subscriptions). Unpaid bills due before the
 * next allowance are set aside in the Money Runway forecast.
 */
export default function BillsSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState(null); // { tone, text }

  const { data: bills = [], isLoading, isError, error } = useQuery({
    queryKey: ["fixed-costs"],
    queryFn: async () => (await api.get("/fixed-costs")).data?.data ?? [],
  });

  // Bills change the runway; paying one also adds a transaction.
  const refreshAll = () =>
    Promise.all(
      ["fixed-costs", "dashboard-summary", "transactions", "budgets", "notifications"].map(
        (key) => queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }) =>
      id
        ? (await api.patch(`/fixed-costs/${id}`, payload)).data
        : (await api.post("/fixed-costs", payload)).data,
    onSuccess: async (_, { id }) => {
      await refreshAll();
      closeForm();
      setMessage({ tone: "ok", text: id ? "Bill updated." : "Bill added." });
    },
    onError: (err) =>
      setFormError(getApiErrorMessage(err, "Couldn't save the bill. Please try again.")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => (await api.delete(`/fixed-costs/${id}`)).data,
    onSuccess: async () => {
      await refreshAll();
      setMessage({ tone: "ok", text: "Bill deleted. Expenses already recorded are kept." });
    },
    onError: (err) =>
      setMessage({ tone: "error", text: getApiErrorMessage(err, "Couldn't delete the bill.") }),
  });

  const payMutation = useMutation({
    mutationFn: async (id) => (await api.post(`/fixed-costs/${id}/pay`, {})).data,
    onSuccess: async (response) => {
      await refreshAll();
      const bill = response?.data?.bill;
      setMessage({
        tone: "ok",
        text: `${bill?.name ?? "Bill"} marked as paid. ${formatINR(bill?.amountPaise ?? 0)} was recorded as an expense. Delete that expense on the Transactions page to undo.`,
      });
    },
    onError: (err) =>
      setMessage({ tone: "error", text: getApiErrorMessage(err, "Couldn't mark the bill as paid.") }),
  });

  const startEdit = (bill) => {
    setEditingId(bill._id);
    setForm({
      name: bill.name,
      amount: String(bill.amountPaise / 100),
      dueDay: String(bill.dueDay),
      category: bill.category || "Other",
    });
    setFormError("");
    setIsFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    const dueDay = Number(form.dueDay);

    if (!form.name.trim()) return setFormError("Give the bill a name, e.g. Rent.");
    if (isNaN(amount) || amount <= 0) return setFormError("Enter an amount greater than ₹0.");
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
      return setFormError("Due day must be a whole number from 1 to 31.");
    }

    saveMutation.mutate({
      id: editingId,
      payload: {
        name: form.name.trim(),
        amountPaise: Math.round(amount * 100),
        dueDay,
        category: form.category,
      },
    });
  };

  const monthlyTotal = bills.reduce((sum, bill) => sum + bill.amountPaise, 0);

  return (
    <section className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-emerald/10 border border-brand-emerald/25 flex items-center justify-center">
            <Receipt className="w-5 h-5 text-brand-emerald" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Monthly Bills</h2>
            <p className="text-xs text-slate-400">
              Rent, phone, subscriptions… Unpaid bills due before your next
              allowance are set aside in your Money Runway.
            </p>
          </div>
        </div>
        {!isFormOpen && (
          <button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setFormError("");
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold px-4 py-2 rounded-xl text-sm transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bill</span>
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mx-5 sm:mx-6 mt-4 rounded-lg border px-3 py-2 text-sm flex items-start justify-between gap-3 ${
            message.tone === "ok"
              ? "bg-brand-emerald/10 border-brand-emerald/25 text-brand-emerald-light"
              : "bg-red-500/10 border-red-500/25 text-red-300"
          }`}
          role="status"
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} aria-label="Dismiss" className="shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="mx-5 sm:mx-6 mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_0.7fr_1.2fr] gap-3 items-end"
        >
          <div>
            <label htmlFor="bill-name" className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Name
            </label>
            <input id="bill-name" value={form.name} maxLength={60} placeholder="Rent"
              onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label htmlFor="bill-amount" className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Amount (₹)
            </label>
            <input id="bill-amount" type="number" min="1" step="any" value={form.amount} placeholder="4000"
              onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label htmlFor="bill-day" className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Due day
            </label>
            <input id="bill-day" type="number" min="1" max="31" step="1" value={form.dueDay} placeholder="1"
              onChange={(e) => setForm({ ...form, dueDay: e.target.value })} className={`${inputClass} font-mono`} />
          </div>
          <div>
            <label htmlFor="bill-category" className="block text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Category
            </label>
            <select id="bill-category" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-navy-850 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-emerald">
              {BILL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {formError && <p className="sm:col-span-4 text-xs text-red-400">{formError}</p>}
          <div className="sm:col-span-4 flex justify-end gap-2">
            <button type="button" onClick={closeForm}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" disabled={saveMutation.isPending}
              className="flex items-center gap-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-60">
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Save Changes" : "Add Bill"}
            </button>
          </div>
        </form>
      )}

      <div className="p-5 sm:p-6">
        {isLoading ? (
          <div className="py-6 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-brand-emerald" /> Loading bills…
          </div>
        ) : isError ? (
          <p className="text-sm text-red-400">
            {getApiErrorMessage(error, "Couldn't load your bills.")}
          </p>
        ) : bills.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            No bills yet. Add rent or subscriptions so your runway can plan for them.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-white/5">
              {bills.map((bill) => {
                const due = bill.nextDue;
                const isBusy =
                  (payMutation.isPending && payMutation.variables === bill._id) ||
                  (deleteMutation.isPending && deleteMutation.variables === bill._id);
                return (
                  <li key={bill._id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{bill.name}</p>
                      <p className="text-xs text-slate-400">
                        {formatINR(bill.amountPaise)} · every month on the {ordinal(bill.dueDay)} · {bill.category}
                      </p>
                    </div>
                    <div className="text-xs sm:w-40">
                      {due?.overdue ? (
                        <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Overdue since {formatDay(due.dueDate)}
                        </span>
                      ) : due ? (
                        <span className="text-slate-300">Next due {formatDay(due.dueDate)}</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => payMutation.mutate(bill._id)}
                        disabled={isBusy || !due}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-emerald/15 text-brand-emerald-light border border-brand-emerald/25 hover:bg-brand-emerald/25 disabled:opacity-50"
                      >
                        {payMutation.isPending && payMutation.variables === bill._id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        Mark paid
                      </button>
                      <button onClick={() => startEdit(bill)} disabled={isBusy} title="Edit" aria-label={`Edit ${bill.name}`}
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${bill.name}"? Expenses already recorded for it are kept.`)) {
                            deleteMutation.mutate(bill._id);
                          }
                        }}
                        disabled={isBusy}
                        title="Delete"
                        aria-label={`Delete ${bill.name}`}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-slate-400 mt-3">
              Total: {formatINR(monthlyTotal)} a month
            </p>
          </>
        )}
      </div>
    </section>
  );
}
