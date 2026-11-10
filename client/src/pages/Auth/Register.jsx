import React, { useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus, AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import api from "../../services/api";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) setErrorMessage("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await api.post("/auth/register", {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      // Extract created user from standardized backend response: { data: { user } }
      const user = response.data.data.user;
      setRegisteredEmail(user.email);
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Registration failed. Please try again with valid information.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  // If successfully registered, show verification instructions
  if (registeredEmail) {
    return (
      <AuthLayout subtitle="Verify your email to get started">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="w-14 h-14 rounded-full bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
            <Mail className="w-7 h-7 text-brand-emerald animate-pulse" />
          </div>

          <div className="bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald-light p-3.5 rounded-lg text-sm flex items-start gap-2.5 text-left">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-brand-emerald" />
            <p className="leading-relaxed">
              We sent a verification link to{" "}
              <strong className="text-white">{registeredEmail}</strong>. Please check your inbox and verify before logging in.
            </p>
          </div>

          <Link
            to="/login"
            className="w-full mt-4 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold py-3 px-4 rounded-lg transition duration-200 text-sm flex items-center justify-center"
          >
            Go to Login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle="Create your student account to begin tracking expenses.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Full Name input */}
        <div>
          <label
            htmlFor="name"
            className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5"
          >
            Full Name
          </label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Alex Johnson"
            required
            autoComplete="name"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald transition-colors"
          />
        </div>

        {/* Email input */}
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
            value={formData.email}
            onChange={handleChange}
            placeholder="student@university.edu"
            required
            autoComplete="email"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald transition-colors"
          />
        </div>

        {/* Password input */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5"
          >
            Password (min 8 chars)
          </label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-emerald focus:ring-1 focus:ring-brand-emerald transition-colors"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </>
          )}
        </button>
      </form>

      {/* Switch to Login */}
      <div className="mt-6 text-xs sm:text-sm text-slate-400">
        Already have an account?{" "}
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

