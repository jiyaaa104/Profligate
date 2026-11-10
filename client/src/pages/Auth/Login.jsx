import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, AlertCircle, Loader2 } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import api from "../../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      const response = await api.post("/auth/login", {
        email: formData.email.trim(),
        password: formData.password,
      });

      // Extract user from standardized backend response: { data: { user, accessToken } }
      const user = response.data.data.user;
      
      // Store user info in localStorage for client state persistence
      localStorage.setItem("profligate_user", JSON.stringify(user));

      // Redirect to dashboard (or overview)
      navigate("/dashboard");
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "Failed to log in. Please check your credentials.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout subtitle="Log in to continue managing your student finances.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

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
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs uppercase tracking-wider text-slate-400 font-semibold"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-slate-400 hover:text-brand-emerald transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
            autoComplete="current-password"
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
              <span>Logging in...</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Log In</span>
            </>
          )}
        </button>
      </form>

      {/* Switch to Register */}
      <div className="mt-6 text-xs sm:text-sm text-slate-400">
        Don't have an account?{" "}
        <Link
          to="/register"
          className="text-brand-emerald font-semibold hover:underline"
        >
          Sign Up
        </Link>
      </div>
    </AuthLayout>
  );
}

