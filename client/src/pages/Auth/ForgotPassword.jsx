import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Send, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import api from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiErrors";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sentTo, setSentTo] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    const trimmedEmail = email.trim();

    try {
      await api.post("/auth/forgot-password", { email: trimmedEmail });
      setSentTo(trimmedEmail);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "Couldn't send the reset email. Please try again in a moment.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // The backend gives the same answer whether or not the email is registered,
  // so this screen must not claim the account exists.
  if (sentTo) {
    return (
      <AuthLayout subtitle="Reset your password">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-14 h-14 rounded-full bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center">
            <Mail className="w-7 h-7 text-brand-emerald" />
          </div>
          <h2 className="text-lg font-bold text-white">Check your inbox</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            If <span className="font-semibold text-white">{sentTo}</span> has a
            Profligate account, we've sent it a link to reset your password.
            The link expires in 20 minutes.
          </p>
          <p className="text-xs text-slate-400">
            Can't find it? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={() => setSentTo("")}
              className="text-brand-emerald font-semibold hover:underline"
            >
              try again
            </button>
            .
          </p>
          <Link
            to="/login"
            className="w-full mt-2 bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 text-sm text-center border border-white/10"
          >
            Back to Login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Enter your account's email and we'll send you a link to reset your password.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
            placeholder="student@university.edu"
            required
            autoComplete="email"
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sending link...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send Reset Link</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-xs sm:text-sm">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-brand-emerald transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Login</span>
        </Link>
      </div>
    </AuthLayout>
  );
}
