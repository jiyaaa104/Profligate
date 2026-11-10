import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import AuthLayout from "../../components/layout/AuthLayout";
import api from "../../services/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [status, setStatus] = useState("verifying"); // 'verifying' | 'success' | 'error'
  const [message, setMessage] = useState("");
  const hasRequested = useRef(false);

  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;

    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Please use the link sent to your email.");
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        
        // Save user session to localStorage if provided
        const userData = response.data?.data?.user;
        if (userData) {
          localStorage.setItem("profligate_user", JSON.stringify(userData));
        }

        setStatus("success");
        setMessage(
          response.data?.message || "Email verified successfully! You are now logged in."
        );
      } catch (error) {
        setStatus("error");
        setMessage(
          error.response?.data?.message ||
            "Verification link is invalid or has expired. Please log in or request a new link."
        );
      }
    };

    verifyToken();
  }, [token]);

  return (
    <AuthLayout subtitle="Account Security & Email Verification">
      <div className="flex flex-col items-center justify-center py-4 text-center">
        {/* Loading state */}
        {status === "verifying" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
              <Loader2 className="w-7 h-7 animate-spin text-brand-emerald" />
            </div>
            <h2 className="text-lg font-bold text-white">Verifying your email...</h2>
            <p className="text-sm text-slate-400 max-w-xs">
              Please wait while we validate your one-time verification token.
            </p>
          </div>
        )}

        {/* Success state */}
        {status === "success" && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="w-14 h-14 rounded-full bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald">
              <CheckCircle2 className="w-7 h-7 text-brand-emerald" />
            </div>
            <h2 className="text-lg font-bold text-white">Email Verified!</h2>
            <div className="bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald-light p-3.5 rounded-lg text-sm leading-relaxed w-full">
              {message}
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full mt-2 bg-brand-emerald hover:bg-brand-emerald-hover text-navy-950 font-bold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Verification Failed</h2>
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-lg text-sm leading-relaxed w-full text-left flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{message}</span>
            </div>
            <Link
              to="/login"
              className="w-full mt-2 bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 text-sm text-center border border-white/10"
            >
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

