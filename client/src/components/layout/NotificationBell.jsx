import React, { useState, useRef, useEffect, useId } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import api from "../../services/api";
import { formatDate } from "../../utils/formatters";

export default function NotificationBell() {
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef = useRef(null);
  const bellButtonRef = useRef(null);

  const dropdownId = useId();

  // Fetch notifications
  const {
    data: notifications = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["notifications"],

    queryFn: async () => {
      const response = await api.get("/notifications");

      const data = response.data?.data;

      return Array.isArray(data) ? data : [];
    },

    // Always consider cached data stale.
    staleTime: 0,

    // Check for new notifications every 15 seconds.
    refetchInterval: 15000,

    // Avoid unnecessary background network requests.
    refetchIntervalInBackground: false,

    // Refresh when the user returns to the tab.
    refetchOnWindowFocus: true,

    // Always fetch when the component mounts.
    refetchOnMount: "always",

    retry: 1,
  });

  // Close dropdown on outside click or Escape key.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
        bellButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Refresh notifications when the bell is opened.
  const handleBellClick = () => {
    const nextState = !isOpen;

    setIsOpen(nextState);

    if (nextState) {
      refetch();
    }
  };

  // Mark all notifications as read.
  const markReadMutation = useMutation({
    mutationFn: async () => {
      await api.patch("/notifications/read");
    },

    // Optimistic update.
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: ["notifications"],
      });

      const previousNotifications = queryClient.getQueryData(["notifications"]);

      queryClient.setQueryData(["notifications"], (old = []) =>
        old.map((notification) => ({
          ...notification,
          isRead: true,
        })),
      );

      return { previousNotifications };
    },

    // Roll back if the API request fails.
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications !== undefined) {
        queryClient.setQueryData(
          ["notifications"],
          context.previousNotifications,
        );
      }
    },

    // Synchronize with the server.
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications"],
      });
    },
  });

  // Check whether any notification is unread.
  const hasUnread = notifications.some((notification) => !notification.isRead);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        ref={bellButtonRef}
        type="button"
        onClick={handleBellClick}
        aria-label={hasUnread ? "Notifications, unread items" : "Notifications"}
        aria-expanded={isOpen}
        aria-controls={dropdownId}
        className="relative p-2 rounded-full hover:bg-white/10 transition-colors text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald"
      >
        <Bell className="w-5 h-5" />

        {hasUnread && (
          <span
            className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-navy-900 animate-pulse"
            aria-label="Unread notifications"
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          id={dropdownId}
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-navy-850 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>

              {isFetching && !isLoading && (
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
              )}
            </div>

            {hasUnread && (
              <button
                type="button"
                onClick={() => markReadMutation.mutate()}
                disabled={markReadMutation.isPending}
                className="text-xs text-brand-emerald hover:text-brand-emerald-light flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-emerald rounded"
              >
                {markReadMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCheck className="w-3 h-3" />
                )}

                {markReadMutation.isPending ? "Marking..." : "Mark all read"}
              </button>
            )}
          </div>

          {/* Mutation Error */}
          {markReadMutation.isError && (
            <div
              className="px-3 py-2 text-xs text-rose-400 bg-rose-500/10"
              role="alert"
            >
              Failed to mark notifications as read. Please try again.
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 flex justify-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : isError && notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-rose-400 mb-3">
                  Failed to load notifications.
                </p>

                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-2 text-xs text-brand-emerald hover:text-brand-emerald-light"
                >
                  <RefreshCw className="w-3 h-3" />
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">
                No notifications yet.
              </div>
            ) : (
              <>
                {isError && (
                  <p
                    className="px-3 py-2 text-xs text-amber-400 bg-amber-500/10"
                    role="status"
                  >
                    Unable to refresh notifications. Showing cached results.
                  </p>
                )}

                <div className="divide-y divide-white/5">
                  {notifications.map((notif) => (
                    <div
                      key={notif._id}
                      className={`p-4 transition-colors hover:bg-white/5 ${
                        !notif.isRead ? "bg-brand-emerald/5" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                          <Bell className="w-4 h-4 text-rose-400" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${
                              !notif.isRead
                                ? "font-bold text-white"
                                : "font-semibold text-slate-300"
                            }`}
                          >
                            {notif.title}
                          </p>

                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed break-words">
                            {notif.message}
                          </p>

                          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
                            {formatDate(notif.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
