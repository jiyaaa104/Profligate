import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import api from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiErrors";

const MIN_PASSWORD_LENGTH = 8;

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald transition-colors";

const labelClass =
  "block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({ password: "", confirm: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDone, setIsDone] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }
    if (formData.password !== formData.confirm) {
      setErrorMessage("The two passwords don't match.");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: formData.password,
      });
      // The backend signs out every session after a reset.
      localStorage.removeItem("profligate_user");
      setIsDone(true);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "Couldn't reset your password. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout subtitle="Reset your password">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-white">Link is incomplete</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            This reset link is missing its code. Open the link from your email
            again, or request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="w-full mt-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold py-3 px-4 rounded-lg transition duration-200 text-sm text-center"
          >
            Request a New Link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (isDone) {
    return (
      <AuthLayout subtitle="Reset your password">
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-14 h-14 rounded-full bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-brand-emerald" />
          </div>
          <h2 className="text-lg font-bold text-white">Password updated</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            You've been signed out on all devices. Log in with your new
            password.
          </p>
          <Link
            to="/login"
            className="w-full mt-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2 text-sm"
          >
            <span>Go to Login</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Choose a new password for your account.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="leading-snug">
              {errorMessage}
              {/expired|invalid/i.test(errorMessage) && (
                <>
                  {" "}
                  <Link
                    to="/forgot-password"
                    className="font-semibold underline hover:text-red-300"
                  >
                    Request a new link
                  </Link>
                </>
              )}
            </span>
          </div>
        )}

        <div>
          <label htmlFor="password" className={labelClass}>
            New Password (min {MIN_PASSWORD_LENGTH} chars)
          </label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="confirm" className={labelClass}>
            Confirm New Password
          </label>
          <input
            id="confirm"
            type="password"
            name="confirm"
            value={formData.confirm}
            onChange={handleChange}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            className={inputClass}
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
              <span>Updating password...</span>
            </>
          ) : (
            <>
              <KeyRound className="w-4 h-4" />
              <span>Reset Password</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-xs sm:text-sm text-slate-400">
        Remembered it?{" "}
        <Link
          to="/login"
          className="text-brand-emerald font-semibold hover:underline"
        >
          Log In
        </Link>
      </div>
    </AuthLayout>
  );
}
