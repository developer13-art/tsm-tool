import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Smartphone,
  ServerCog,
  TerminalSquare,
  Users,
  Settings,
  LogOut,
  Bot,
  BookOpen,
  Wand2,
} from "lucide-react";

interface AgentStatus {
  connected: boolean;
  deviceCount: number;
  agentVersion: string | null;
  lastSeen: number | null;
}

function useAgentStatus(enabled: boolean) {
  return useQuery<AgentStatus>({
    queryKey: ["agent-status"],
    queryFn: async () => {
      const r = await fetch("/api/agent/status", { credentials: "include" });
      if (!r.ok) throw new Error("status fetch failed");
      return r.json();
    },
    refetchInterval: 8000,
    staleTime: 7000,
    retry: false,
    enabled,
  });
}

function AgentDot({ status }: { status: AgentStatus | undefined }) {
  if (!status) return null;
  if (status.connected) {
    return (
      <span className="flex items-center gap-1 ml-auto">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        {status.deviceCount > 0 && (
          <span className="text-[10px] font-mono text-emerald-400 leading-none">
            {status.deviceCount}
          </span>
        )}
      </span>
    );
  }
  return (
    <span className="ml-auto h-2 w-2 rounded-full bg-zinc-600 shrink-0" />
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: agentStatus } = useAgentStatus(!!user);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, extra: null },
    { href: "/wizard", label: "Removal Wizard", icon: Wand2, extra: null },
    { href: "/devices", label: "Devices", icon: Smartphone, extra: null },
    { href: "/jobs", label: "Jobs", icon: ServerCog, extra: null },
    { href: "/console", label: "Live Console", icon: TerminalSquare, extra: null },
    { href: "/agent", label: "Local Agent", icon: Bot, extra: "agent-status" },
    { href: "/guide", label: "Connection Guide", icon: BookOpen, extra: null },
    ...(user?.role === "admin" ? [{ href: "/users", label: "Users", icon: Users, extra: null }] : []),
    { href: "/settings", label: "Settings", icon: Settings, extra: null },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-primary">
            <TerminalSquare className="w-6 h-6" />
            <span className="font-bold text-lg tracking-tight">TSM PRO</span>
          </div>
          {/* Global agent indicator in header */}
          {agentStatus?.connected && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-mono text-emerald-400">LIVE</span>
            </div>
          )}
        </div>

        <div className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium border border-sidebar-accent-border/50 shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span className="flex-1">{item.label}</span>
                {item.extra === "agent-status" && (
                  <AgentDot status={agentStatus} />
                )}
              </Link>
            );
          })}
        </div>

        {/* Agent status bar at bottom of sidebar */}
        {agentStatus !== undefined && (
          <div className={`mx-3 mb-2 px-3 py-2 rounded-md border text-xs font-mono flex items-center gap-2 ${
            agentStatus.connected
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
              : "border-zinc-800 bg-zinc-900/40 text-zinc-600"
          }`}>
            <Bot className="w-3 h-3 shrink-0" />
            {agentStatus.connected ? (
              <span className="flex-1 truncate">
                Agent online
                {agentStatus.deviceCount > 0
                  ? ` · ${agentStatus.deviceCount} device${agentStatus.deviceCount !== 1 ? "s" : ""}`
                  : " · no devices"}
              </span>
            ) : (
              <span className="flex-1">Agent offline</span>
            )}
          </div>
        )}

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-sidebar-foreground mb-2">
            <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-primary font-bold border border-border">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="font-medium leading-none">{user?.username}</span>
              <span className="text-xs text-muted-foreground mt-1">{user?.role}</span>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <div className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
