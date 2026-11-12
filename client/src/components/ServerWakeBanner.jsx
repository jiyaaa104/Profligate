import React, { useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import {
  getServerWaking,
  subscribeToServerWake,
} from "../services/serverWake";

/**
 * Shown while the API is waking up from sleep, so a slow first request
 * looks intentional rather than broken.
 */
export default function ServerWakeBanner() {
  const isWaking = useSyncExternalStore(subscribeToServerWake, getServerWaking);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 w-full max-w-md"
    >
      {isWaking && (
        <div className="glass-panel-glow rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-slate-200 shadow-glass-sm">
          <Loader2 className="w-4 h-4 animate-spin text-brand-emerald shrink-0" />
          <span>
            Starting up the server. This can take up to a minute the first
            time…
          </span>
        </div>
      )}
    </div>
  );
}
