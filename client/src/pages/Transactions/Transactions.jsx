import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  X,
  Loader2,
  Calendar,
  CreditCard,
  AlertCircle,
  Filter,
} from "lucide-react";

import api from "../../services/api";
import { formatINR, formatDate } from "../../utils/formatters";

// --------------------------------------------------
// Constants
// --------------------------------------------------

const EXPENSE_CATEGORIES = [
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

const INCOME_CATEGORIES = [
  "Allowance",
  "Stipend",
  "Salary",
  "Freelance",
  "Gift",
  "Refund",
  "Other",
];

const PAYMENT_METHODS = [
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Debit/Credit Card" },
  { value: "netbanking", label: "Net Banking" },
  { value: "other", label: "Other" },
];

const PAGE_LIMIT = 10;

// --------------------------------------------------
// Utility Functions
// --------------------------------------------------

// Returns today's date in local YYYY-MM-DD format.
const getLocalDateString = () => {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

// Converts a date-only input into a local midnight Date.
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  // Reject invalid or normalized calendar dates.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

// Converts a rupee string into integer paise
// without relying on floating-point multiplication.
const convertRupeesToPaise = (amount) => {
  const value = amount.trim();

  if (!/^(?:\d+|\d+\.\d{1,2}|\.\d{1,2})$/.test(value)) {
    return null;
  }

  const [rupees = "0", paise = ""] = value.split(".");

  const amountPaise = Number(rupees) * 100 + Number(paise.padEnd(2, "0"));

  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return null;
  }

  return amountPaise;
};

// Integer paise -> "1234.5" style string for the amount field.
const paiseToRupeesString = (paise) => {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  if (rest === 0) return String(rupees);
  return `${rupees}.${String(rest).padStart(2, "0")}`.replace(/0$/, "");
};

// ISO timestamp -> the user's local YYYY-MM-DD.
const toLocalDateString = (iso) => {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// --------------------------------------------------
// Initial Form State
// --------------------------------------------------

const getInitialFormState = () => ({
  amount: "",
  type: "expense",
  category: "Food",
  description: "",
  paymentMethod: "upi",
  transactionDate: getLocalDateString(),
});

// --------------------------------------------------
// Component
// --------------------------------------------------

export default function Transactions() {
  const queryClient = useQueryClient();

  // -----------------------------------------------
  // Local UI State
  // -----------------------------------------------

  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);

  // The transaction being edited, or null when adding a new one.
  const [editingTx, setEditingTx] = useState(null);

  const [formError, setFormError] = useState("");

  const [formData, setFormData] = useState(getInitialFormState);

  // -----------------------------------------------
  // Query: Fetch Transactions
  // -----------------------------------------------

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["transactions", page, typeFilter],

    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
      });

      if (typeFilter) {
        params.set("type", typeFilter);
      }

      const response = await api.get(`/transactions?${params.toString()}`);

      return response.data?.data;
    },
  });

  const transactions = data?.transactions ?? [];

  const pagination = data?.pagination ?? {
    page: 1,
    totalPages: 1,
    total: 0,
  };

  const totalPages = Math.max(1, pagination.totalPages || 1);

  // -----------------------------------------------
  // Pagination Correction
  // -----------------------------------------------

  useEffect(() => {
    if (!isLoading && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, isLoading]);

  // -----------------------------------------------
  // Modal Keyboard Accessibility
  // -----------------------------------------------

  useEffect(() => {
    if (!isModalOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape" && !isSaving) {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isModalOpen]);

  // -----------------------------------------------
  // Mutation: Create Transaction
  // -----------------------------------------------

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post("/transactions", payload);

      return response.data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["budgets"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["notifications"],
        }),

        // Balance and Money Runway on the dashboard
        queryClient.invalidateQueries({
          queryKey: ["dashboard-summary"],
        }),

        // Deleting a bill payment marks that bill unpaid again
        queryClient.invalidateQueries({
          queryKey: ["fixed-costs"],
        }),
      ]);

      // Newly created transactions are generally
      // displayed on the first page.
      setPage(1);

      setIsModalOpen(false);
      setFormData(getInitialFormState());
      setFormError("");
    },

    onError: (err) => {
      setFormError(
        err.response?.data?.message ||
          "Failed to create transaction. Please check your details.",
      );
    },
  });

  // -----------------------------------------------
  // Mutation: Update Transaction
  // -----------------------------------------------

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await api.patch(`/transactions/${id}`, payload);

      return response.data;
    },

    onSuccess: async () => {
      // An edit can change the balance, runway, budgets and bills.
      await Promise.all(
        ["transactions", "budgets", "notifications", "dashboard-summary", "fixed-costs"].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );

      setIsModalOpen(false);
      setEditingTx(null);
      setFormData(getInitialFormState());
      setFormError("");
    },

    onError: (err) => {
      setFormError(
        err.response?.data?.message ||
          "Failed to update transaction. Please check your details.",
      );
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // -----------------------------------------------
  // Mutation: Delete Transaction
  // -----------------------------------------------

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await api.delete(`/transactions/${id}`);

      return response.data;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["transactions"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["budgets"],
        }),

        queryClient.invalidateQueries({
          queryKey: ["notifications"],
        }),

        // Balance and Money Runway on the dashboard
        queryClient.invalidateQueries({
          queryKey: ["dashboard-summary"],
        }),

        // Deleting a bill payment marks that bill unpaid again
        queryClient.invalidateQueries({
          queryKey: ["fixed-costs"],
        }),
      ]);
    },

    onError: (err) => {
      alert(
        err.response?.data?.message ||
          "Failed to delete transaction. Please try again.",
      );
    },
  });

  // -----------------------------------------------
  // Form Handlers
  // -----------------------------------------------

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (formError) {
      setFormError("");
    }
  };

  const handleTypeChange = (type) => {
    setFormData((prev) => ({
      ...prev,
      type,
      category: type === "income" ? "Allowance" : "Food",
    }));

    setFormError("");
  };

  const openModal = () => {
    setEditingTx(null);
    setFormData(getInitialFormState());
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (tx) => {
    setEditingTx(tx);
    setFormData({
      amount: paiseToRupeesString(tx.amountPaise),
      type: tx.type,
      category: tx.category,
      description: tx.description || "",
      paymentMethod: tx.paymentMethod || "upi",
      transactionDate: toLocalDateString(tx.transactionDate),
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;

    setIsModalOpen(false);
    setEditingTx(null);
    setFormError("");
  };

  // -----------------------------------------------
  // Form Submission
  // -----------------------------------------------

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    const amountPaise = convertRupeesToPaise(formData.amount);

    if (amountPaise === null) {
      setFormError(
        "Please enter a valid amount greater than zero with up to 2 decimal places.",
      );
      return;
    }

    const transactionDate = parseLocalDate(formData.transactionDate);

    if (!transactionDate) {
      setFormError("Please select a valid transaction date.");
      return;
    }

    if (!formData.category.trim()) {
      setFormError("Please select a transaction category.");
      return;
    }

    if (editingTx) {
      const payload = {
        amountPaise,
        type: formData.type,
        category: formData.category.trim(),
        description: formData.description.trim(),
        paymentMethod: formData.paymentMethod,
      };

      // Keep the original time of day unless the date itself changed.
      if (formData.transactionDate !== toLocalDateString(editingTx.transactionDate)) {
        payload.transactionDate = transactionDate.toISOString();
      }

      updateMutation.mutate({ id: editingTx._id, payload });
      return;
    }

    createMutation.mutate({
      amountPaise,

      type: formData.type,

      category: formData.category.trim(),

      description: formData.description.trim() || undefined,

      paymentMethod: formData.paymentMethod,

      transactionDate: transactionDate.toISOString(),
    });
  };

  // -----------------------------------------------
  // Delete Handler
  // -----------------------------------------------

  const handleDelete = (id, description) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${description || "this transaction"}"?`,
    );

    if (confirmed) {
      deleteMutation.mutate(id);
    }
  };

  // -----------------------------------------------
  // Filter Handler
  // -----------------------------------------------

  const handleFilterChange = (filter) => {
    setTypeFilter(filter);
    setPage(1);
  };

  // -----------------------------------------------
  // Derived State
  // -----------------------------------------------

  const baseCategories =
    formData.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Keep an older or custom category selectable when editing.
  const activeCategories =
    formData.category && !baseCategories.includes(formData.category)
      ? [formData.category, ...baseCategories]
      : baseCategories;

  const isBillPayment = Boolean(editingTx?.fixedCostId);

  // -----------------------------------------------
  // Render
  // -----------------------------------------------

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ==========================================
          HEADER
      ========================================== */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Transactions
          </h1>

          <p className="text-sm text-slate-400 mt-1">
            Manage your daily student income, allowances, and spending.
          </p>
        </div>

        <button
          onClick={openModal}
          className="flex items-center justify-center gap-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* ==========================================
          FILTER BAR
      ========================================== */}

      <div className="glass-panel rounded-xl p-2 border-white/5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 pl-2 pr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Type:</span>
          </span>

          <button
            onClick={() => handleFilterChange("")}
            className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-medium transition-all ${
              typeFilter === ""
                ? "bg-white/10 text-white font-semibold"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            All
          </button>

          <button
            onClick={() => handleFilterChange("expense")}
            className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-medium transition-all ${
              typeFilter === "expense"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                : "text-slate-400 hover:text-rose-300 hover:bg-white/5"
            }`}
          >
            Expenses
          </button>

          <button
            onClick={() => handleFilterChange("income")}
            className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-medium transition-all ${
              typeFilter === "income"
                ? "bg-emerald-500/20 text-brand-emerald-light border border-emerald-500/30"
                : "text-slate-400 hover:text-emerald-300 hover:bg-white/5"
            }`}
          >
            Income
          </button>
        </div>

        <div className="text-xs text-slate-400 pr-2 whitespace-nowrap">
          Page {pagination.page || page} of {totalPages}
        </div>
      </div>

      {/* ==========================================
          TRANSACTIONS TABLE
      ========================================== */}

      <div className="glass-panel rounded-2xl border-white/5 overflow-hidden">
        {isLoading ? (
          // Loading State

          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-brand-emerald" />

            <p className="text-sm">Loading transactions...</p>
          </div>
        ) : isError ? (
          // Error State

          <div className="p-8 text-center text-red-400 flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6" />

            <p className="text-sm">
              {error?.response?.data?.message || "Failed to load transactions."}
            </p>

            <button
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["transactions", page, typeFilter],
                })
              }
              className="mt-2 text-xs underline hover:text-red-300"
            >
              Try again
            </button>
          </div>
        ) : transactions.length === 0 ? (
          // Empty State

          <div className="py-20 text-center flex flex-col items-center justify-center gap-3 px-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
              <Receipt className="w-7 h-7 text-slate-500" />
            </div>

            <h3 className="text-base font-bold text-slate-200">
              No transactions found
            </h3>

            <p className="text-xs text-slate-400 max-w-sm">
              {typeFilter
                ? `No ${typeFilter} records match this filter.`
                : "You haven't added any transactions yet. Record your expenses or allowance to track cash flow."}
            </p>

            <button
              onClick={openModal}
              className="mt-2 text-xs font-semibold bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 px-4 py-2.5 rounded-lg transition-colors"
            >
              + Record Transaction
            </button>
          </div>
        ) : (
          // Transactions List
          <>
          {/* Phones and tablets: one card per transaction (the table needs ~660px). */}
          <ul className="lg:hidden divide-y divide-white/5">
            {transactions.map((tx) => {
              const isIncome = tx.type === "income";
              const isDeleting =
                deleteMutation.isPending && deleteMutation.variables === tx._id;
              const paymentLabel =
                PAYMENT_METHODS.find((pm) => pm.value === tx.paymentMethod)?.label || "UPI";
              const name = tx.description || tx.category;

              return (
                <li key={tx._id} className="p-4 flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isIncome
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}
                  >
                    {isIncome ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-white text-sm leading-snug break-words min-w-0">
                        {name}
                      </p>
                      <span
                        className={`font-mono font-bold text-sm whitespace-nowrap ${
                          isIncome ? "text-emerald-400" : "text-slate-100"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatINR(tx.amountPaise)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-400 min-w-0">
                        <span className="capitalize">{tx.category}</span> ·{" "}
                        {formatDate(tx.transactionDate)} · {paymentLabel}
                      </p>

                      <div className="flex items-center shrink-0 -mr-2">
                        <button
                          onClick={() => openEditModal(tx)}
                          disabled={isDeleting}
                          aria-label={`Edit transaction ${name}`}
                          className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx._id, name)}
                          disabled={deleteMutation.isPending}
                          aria-label={`Delete transaction ${name}`}
                          className="p-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Wider screens: the full table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-white/[0.02]">
                  <th className="py-3.5 px-4 sm:px-6">
                    Description & Category
                  </th>

                  <th className="py-3.5 px-4">Date</th>

                  <th className="py-3.5 px-4">Method</th>

                  <th className="py-3.5 px-4 text-right">Amount</th>

                  <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5 text-sm">
                {transactions.map((tx) => {
                  const isIncome = tx.type === "income";

                  const isDeleting =
                    deleteMutation.isPending &&
                    deleteMutation.variables === tx._id;

                  const paymentLabel =
                    PAYMENT_METHODS.find((pm) => pm.value === tx.paymentMethod)
                      ?.label || "UPI";

                  return (
                    <tr
                      key={tx._id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Description & Category */}

                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isIncome
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            }`}
                          >
                            {isIncome ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>

                          <div>
                            <p className="font-semibold text-white">
                              {tx.description || tx.category}
                            </p>

                            <span className="text-xs text-slate-400 capitalize">
                              {tx.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date */}

                      <td className="py-4 px-4 text-xs sm:text-sm text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />

                          <span>{formatDate(tx.transactionDate)}</span>
                        </div>
                      </td>

                      {/* Payment Method */}

                      <td className="py-4 px-4 text-xs text-slate-300 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md uppercase text-[11px] font-medium tracking-wide">
                          <CreditCard className="w-3 h-3 text-slate-400" />

                          {paymentLabel}
                        </span>
                      </td>

                      {/* Amount */}

                      <td className="py-4 px-4 text-right whitespace-nowrap font-mono font-bold">
                        <span
                          className={
                            isIncome ? "text-emerald-400" : "text-slate-100"
                          }
                        >
                          {isIncome ? "+" : "-"}

                          {formatINR(tx.amountPaise)}
                        </span>
                      </td>

                      {/* Edit & Delete Actions */}

                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(tx)}
                          disabled={isDeleting}
                          title="Edit transaction"
                          aria-label={`Edit transaction ${tx.description || tx.category}`}
                          className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(tx._id, tx.description || tx.category)
                          }
                          disabled={deleteMutation.isPending}
                          title="Delete transaction"
                          aria-label={`Delete transaction ${tx.description || tx.category}`}
                          className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* ======================================
            PAGINATION
        ====================================== */}

        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs sm:text-sm text-slate-400">
            <span>
              Showing Page {page} of {totalPages}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page <= 1 || isFetching}
                className="flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed border border-white/5 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />

                <span>Previous</span>
              </button>

              <button
                onClick={() =>
                  setPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={page >= totalPages || isFetching}
                className="flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed border border-white/5 transition-colors"
              >
                <span>Next</span>

                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==========================================
          ADD TRANSACTION MODAL
      ========================================== */}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-modal-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass-panel-glow rounded-2xl p-6 sm:p-8 border border-white/10 text-slate-100 relative shadow-2xl"
          >
            {/* Modal Header */}

            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <h2
                id="transaction-modal-title"
                className="text-xl font-bold text-white flex items-center gap-2"
              >
                <Receipt className="w-5 h-5 text-brand-emerald" />

                <span>{editingTx ? "Edit Transaction" : "Add New Transaction"}</span>
              </h2>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSaving}
                aria-label="Close modal"
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}

            {formError && (
              <div
                role="alert"
                className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs sm:text-sm flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />

                <span>{formError}</span>
              </div>
            )}

            {/* Form */}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Transaction Type */}

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                  Transaction Type
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange("expense")}
                    aria-pressed={formData.type === "expense"}
                    className={`py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                      formData.type === "expense"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm"
                        : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                    }`}
                  >
                    Expense
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTypeChange("income")}
                    disabled={isBillPayment}
                    title={isBillPayment ? "Bill payments stay expenses" : undefined}
                    aria-pressed={formData.type === "income"}
                    className={`py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                      formData.type === "income"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm"
                        : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10"
                    }`}
                  >
                    Income
                  </button>
                </div>

                {isBillPayment && (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    This is a bill payment, so it stays an expense. Delete it to
                    mark the bill unpaid.
                  </p>
                )}
              </div>

              {/* Amount */}

              <div>
                <label
                  htmlFor="transaction-amount"
                  className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5"
                >
                  Amount (₹ in Rupees)
                </label>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    ₹
                  </span>

                  <input
                    id="transaction-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="250.00"
                    required
                    disabled={isSaving}
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Category & Payment Method */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}

                <div>
                  <label
                    htmlFor="transaction-category"
                    className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5"
                  >
                    Category
                  </label>

                  <select
                    id="transaction-category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    disabled={isSaving}
                    className="w-full bg-navy-850 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-emerald"
                  >
                    {activeCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method */}

                <div>
                  <label
                    htmlFor="transaction-payment"
                    className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5"
                  >
                    Payment Method
                  </label>

                  <select
                    id="transaction-payment"
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleInputChange}
                    required
                    disabled={isSaving}
                    className="w-full bg-navy-850 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-emerald"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.value} value={pm.value}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Transaction Date */}

              <div>
                <label
                  htmlFor="transaction-date"
                  className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5"
                >
                  Transaction Date
                </label>

                <input
                  id="transaction-date"
                  type="date"
                  name="transactionDate"
                  value={formData.transactionDate}
                  onChange={handleInputChange}
                  required
                  max={getLocalDateString()}
                  disabled={isSaving}
                  className="w-full bg-navy-850 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-brand-emerald"
                />
              </div>

              {/* Description */}

              <div>
                <label
                  htmlFor="transaction-description"
                  className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5"
                >
                  Description (Optional)
                </label>

                <input
                  id="transaction-description"
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="e.g. Grocery run, Books, Campus canteen"
                  maxLength={200}
                  disabled={isSaving}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald"
                />
              </div>

              {/* Modal Actions */}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingTx ? "Save Changes" : "Add Transaction"}</span>
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
