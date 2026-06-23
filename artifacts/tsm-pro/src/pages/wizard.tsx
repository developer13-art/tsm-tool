import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Circle, Loader2, AlertTriangle, ChevronRight,
  Usb, Shield, HardDrive, Cpu, Power, Terminal, Smartphone,
  RotateCcw, Zap, ArrowRight, RefreshCw, Bot
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentStatus { connected: boolean; deviceCount: number; }
interface Device { id: number; brand: string; model: string; serialNumber: string; chipset: string; status: string; mode: string; }
interface Plugin { packageName: string; displayName: string; description: string; severity: "critical" | "high" | "medium"; }
interface LogLine { level: string; message: string; }

// ─── Severity color ───────────────────────────────────────────────────────────

const severityColor: Record<string, string> = {
  critical: "text-red-400 border-red-500/30 bg-red-500/5",
  high:     "text-orange-400 border-orange-500/30 bg-orange-500/5",
  medium:   "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
};

// ─── Mini console ─────────────────────────────────────────────────────────────

function MiniConsole({ logs }: { logs: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: 9999, behavior: "smooth" }); }, [logs]);

  const color: Record<string, string> = {
    success: "text-emerald-400",
    error:   "text-red-400",
    warning: "text-yellow-400",
    info:    "text-zinc-300",
    debug:   "text-zinc-600",
  };
  const sym: Record<string, string> = { success: "✓", error: "✗", warning: "⚠", info: "ℹ", debug: "·" };

  if (!logs.length) return null;
  return (
    <div ref={ref} className="mt-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-0.5">
      {logs.map((l, i) => (
        <div key={i} className={`${color[l.level] ?? "text-zinc-400"} leading-relaxed`}>
          <span className="opacity-50 mr-1">{sym[l.level] ?? "·"}</span>{l.message}
        </div>
      ))}
    </div>
  );
}

// ─── Step header ──────────────────────────────────────────────────────────────

function StepCard({ icon: Icon, n, title, subtitle, status, children }: {
  icon: typeof Shield; n: number; title: string; subtitle: string;
  status: "waiting" | "active" | "done" | "error"; children?: React.ReactNode;
}) {
  const border = status === "active" ? "border-cyan-500/40 bg-cyan-500/5"
    : status === "done"   ? "border-emerald-500/30 bg-emerald-500/5"
    : status === "error"  ? "border-red-500/30 bg-red-500/5"
    : "border-zinc-800 bg-zinc-900/30 opacity-40";

  return (
    <div className={`rounded-xl border p-5 transition-all ${border}`}>
      <div className="flex items-start gap-4">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          status === "done"   ? "bg-emerald-500/15 border border-emerald-500/30" :
          status === "active" ? "bg-cyan-500/15 border border-cyan-500/30" :
          status === "error"  ? "bg-red-500/15 border border-red-500/30" :
          "bg-zinc-800 border border-zinc-700"
        }`}>
          {status === "done"
            ? <CheckCircle className="w-4 h-4 text-emerald-400" />
            : status === "active"
              ? <Icon className="w-4 h-4 text-cyan-400" />
              : status === "error"
                ? <AlertTriangle className="w-4 h-4 text-red-400" />
                : <span className="text-xs font-mono font-bold text-zinc-500">{String(n).padStart(2, "0")}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-mono font-semibold text-sm ${status === "waiting" ? "text-zinc-600" : "text-white"}`}>{title}</h3>
            {status === "done" && <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">DONE</Badge>}
            {status === "active" && <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono animate-pulse">ACTIVE</Badge>}
            {status === "error" && <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-mono">FAILED</Badge>}
          </div>
          <p className={`text-xs mt-0.5 ${status === "waiting" ? "text-zinc-700" : "text-zinc-500"}`}>{subtitle}</p>
          {status === "active" && children && <div className="mt-4">{children}</div>}
          {status === "done" && children && <div className="mt-3 opacity-60">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STEPS = ["Agent", "Device", "Plugins", "DMD", "MISC", "Done"];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
              i < step  ? "bg-emerald-500 text-black" :
              i === step ? "bg-cyan-500 text-black ring-4 ring-cyan-500/20" :
              "bg-zinc-800 text-zinc-600"
            }`}>
              {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-[10px] font-mono mt-1 ${i === step ? "text-cyan-400" : i < step ? "text-emerald-400" : "text-zinc-600"}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 mb-4 rounded ${i < step ? "bg-emerald-500" : "bg-zinc-800"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Plugin item ──────────────────────────────────────────────────────────────

type PluginState = "pending" | "running" | "done" | "skipped" | "error";

function PluginRow({ plugin, state, logs, onRemove }: {
  plugin: Plugin; state: PluginState; logs: LogLine[]; onRemove: () => void;
}) {
  return (
    <div className={`rounded-lg border p-3 transition-all ${
      state === "done"    ? "border-emerald-500/20 bg-emerald-500/5" :
      state === "running" ? "border-cyan-500/30 bg-cyan-500/5" :
      state === "error"   ? "border-red-500/20 bg-red-500/5" :
      state === "skipped" ? "border-zinc-700 opacity-50" :
      "border-zinc-800 bg-zinc-900/30"
    }`}>
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          {state === "done"    ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
           state === "running" ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" /> :
           state === "error"   ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
           state === "skipped" ? <CheckCircle className="w-4 h-4 text-zinc-600" /> :
           <Circle className="w-4 h-4 text-zinc-700" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${state === "pending" ? "text-zinc-300" : "text-white"}`}>{plugin.displayName}</span>
            <Badge variant="outline" className={`text-[10px] font-mono rounded-sm shrink-0 ${severityColor[plugin.severity]}`}>
              {plugin.severity.toUpperCase()}
            </Badge>
          </div>
          <code className="text-[10px] text-zinc-600 font-mono">{plugin.packageName}</code>
        </div>
        {state === "pending" && (
          <Button size="sm" onClick={onRemove}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-mono h-7 px-3">
            REMOVE
          </Button>
        )}
        {state === "done"    && <span className="text-xs font-mono text-emerald-400">Removed</span>}
        {state === "skipped" && <span className="text-xs font-mono text-zinc-600">Skipped</span>}
        {state === "error"   && <span className="text-xs font-mono text-red-400">Failed</span>}
      </div>
      <MiniConsole logs={logs} />
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function Wizard() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [pluginStates, setPluginStates] = useState<Record<string, PluginState>>({});
  const [pluginLogs, setPluginLogs] = useState<Record<string, LogLine[]>>({});
  const [dmdState, setDmdState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [dmdLogs, setDmdLogs] = useState<LogLine[]>([]);
  const [miscState, setMiscState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [miscLogs, setMiscLogs] = useState<LogLine[]>([]);
  const [opRunning, setOpRunning] = useState(false);

  // ── Polling hooks ──────────────────────────────────────────────────────────

  const { data: agentStatus } = useQuery<AgentStatus>({
    queryKey: ["wizard-agent"],
    queryFn: () => fetch("/api/agent/status", { credentials: "include" }).then(r => r.json()),
    refetchInterval: step === 0 ? 3000 : 10000,
    retry: false,
  });

  const { data: devices, refetch: refetchDevices } = useQuery<Device[]>({
    queryKey: ["wizard-devices"],
    queryFn: () => fetch("/api/devices", { credentials: "include" }).then(r => r.json()),
    refetchInterval: step === 1 ? 4000 : false,
    enabled: step >= 1,
  });

  // Auto-advance step 0 → 1 when agent connects
  useEffect(() => {
    if (step === 0 && agentStatus?.connected) {
      setTimeout(() => setStep(1), 800);
    }
  }, [step, agentStatus?.connected]);

  // Load plugins when device is selected
  useEffect(() => {
    if (!selectedDevice) return;
    const brand = selectedDevice.brand.toLowerCase().replace(/[^a-z]/g, "");
    fetch(`/api/devices/${selectedDevice.id}/operations/plugins`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && Array.isArray(data)) {
          setPlugins(data);
          const states: Record<string, PluginState> = {};
          data.forEach((p: Plugin) => { states[p.packageName] = "pending"; });
          setPluginStates(states);
          setPluginLogs({});
        }
      })
      .catch(() => {});
  }, [selectedDevice]);

  // ── Operation helpers ──────────────────────────────────────────────────────

  async function runOperation(deviceId: number, opType: string, targetId?: string): Promise<{ opId: number } | null> {
    const body: Record<string, unknown> = { operationType: opType };
    if (targetId) body.targetId = targetId;
    const r = await fetch(`/api/devices/${deviceId}/operations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return r.json();
  }

  async function pollLogs(deviceId: number, opId: number, onLog: (l: LogLine) => void): Promise<void> {
    let seen = 0;
    for (let i = 0; i < 60; i++) {
      await new Promise(res => setTimeout(res, 1500));
      try {
        const r = await fetch(`/api/devices/${deviceId}/operations/${opId}/logs`, { credentials: "include" });
        if (!r.ok) continue;
        const { logs, status } = await r.json();
        if (Array.isArray(logs)) {
          for (let j = seen; j < logs.length; j++) {
            onLog({ level: logs[j].level, message: logs[j].message });
          }
          seen = logs.length;
        }
        if (status === "completed" || status === "failed") break;
      } catch { break; }
    }
  }

  // ── Plugin removal ─────────────────────────────────────────────────────────

  async function removePlugin(pkg: string) {
    if (!selectedDevice || opRunning) return;
    setOpRunning(true);
    setPluginStates(s => ({ ...s, [pkg]: "running" }));
    setPluginLogs(l => ({ ...l, [pkg]: [] }));

    const addLog = (line: LogLine) => {
      setPluginLogs(l => ({ ...l, [pkg]: [...(l[pkg] ?? []), line] }));
    };

    addLog({ level: "info", message: `Starting removal of ${pkg}...` });
    const op = await runOperation(selectedDevice.id, "security_plugin_removal", pkg);
    if (!op) {
      addLog({ level: "error", message: "Failed to start operation" });
      setPluginStates(s => ({ ...s, [pkg]: "error" }));
      setOpRunning(false);
      return;
    }

    await pollLogs(selectedDevice.id, op.opId, addLog);
    const finalLogs = await fetch(`/api/devices/${selectedDevice.id}/operations/${op.opId}/logs`, { credentials: "include" }).then(r => r.json()).catch(() => ({ status: "completed" }));
    const success = (finalLogs.status ?? "completed") !== "failed";

    setPluginStates(s => ({ ...s, [pkg]: success ? "done" : "error" }));
    setOpRunning(false);
  }

  async function removeAllPlugins() {
    if (!selectedDevice) return;
    for (const p of plugins) {
      if (pluginStates[p.packageName] === "pending") {
        await removePlugin(p.packageName);
        await new Promise(res => setTimeout(res, 500));
      }
    }
  }

  const allPluginsDone = plugins.length > 0 && plugins.every(p =>
    pluginStates[p.packageName] === "done" ||
    pluginStates[p.packageName] === "skipped" ||
    pluginStates[p.packageName] === "error"
  );

  // ── DMD operation ──────────────────────────────────────────────────────────

  async function runDmd() {
    if (!selectedDevice || opRunning) return;
    setOpRunning(true);
    setDmdState("running");
    setDmdLogs([]);
    const addLog = (l: LogLine) => setDmdLogs(d => [...d, l]);

    addLog({ level: "info", message: "Stopping DMD service..." });
    const op = await runOperation(selectedDevice.id, "dmd_clear");
    if (!op) {
      addLog({ level: "error", message: "Failed to start DMD operation" });
      setDmdState("error");
      setOpRunning(false);
      return;
    }
    await pollLogs(selectedDevice.id, op.opId, addLog);
    setDmdState("done");
    setOpRunning(false);
  }

  // ── MISC operation ─────────────────────────────────────────────────────────

  async function runMisc() {
    if (!selectedDevice || opRunning) return;
    setOpRunning(true);
    setMiscState("running");
    setMiscLogs([]);
    const addLog = (l: LogLine) => setMiscLogs(d => [...d, l]);

    addLog({ level: "info", message: "Reading MISC partition..." });
    const op = await runOperation(selectedDevice.id, "misc_write");
    if (!op) {
      addLog({ level: "error", message: "Failed to start MISC operation" });
      setMiscState("error");
      setOpRunning(false);
      return;
    }
    await pollLogs(selectedDevice.id, op.opId, addLog);
    setMiscState("done");
    setOpRunning(false);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-2xl space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white font-mono tracking-wide">REMOVAL WIZARD</h1>
              <p className="text-xs text-zinc-500 font-mono mt-1">
                Step-by-step guided security plugin removal
              </p>
            </div>
            {step > 0 && step < 5 && (
              <Button variant="outline" size="sm"
                className="border-zinc-700 text-zinc-400 hover:text-white font-mono text-xs gap-1.5"
                onClick={() => navigate(`/devices/${selectedDevice?.id}`)}>
                Open Device Detail <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>

          <ProgressBar step={step} />

          {/* ── Step 0: Agent check ── */}
          <StepCard n={1} icon={Bot} title="Start TSM Agent"
            subtitle="Run tsm_agent.py on your PC to connect to this server"
            status={step === 0 ? "active" : step > 0 ? "done" : "waiting"}>
            <div className="space-y-4">
              {agentStatus?.connected ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-sm text-emerald-200 font-medium">Agent connected — proceeding to device detection...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <Loader2 className="w-4 h-4 text-yellow-400 animate-spin shrink-0" />
                    <span className="text-sm text-yellow-200">Waiting for agent to connect...</span>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-emerald-400">
                    python tsm_agent.py --server {window.location.origin} --token YOUR_TOKEN
                  </div>
                  <p className="text-xs text-zinc-500">
                    Get your token from <strong className="text-zinc-300">Settings → API Tokens</strong>. Download the agent from <strong className="text-zinc-300">Local Agent</strong>.
                  </p>
                </div>
              )}
            </div>
          </StepCard>

          {/* ── Step 1: Connect device ── */}
          <StepCard n={2} icon={Usb} title="Connect Device via BROM"
            subtitle="Power off device → hold Volume Down → plug USB cable"
            status={step < 1 ? "waiting" : step === 1 ? "active" : "done"}>
            <div className="space-y-4">

              {/* BROM instructions */}
              <div className="space-y-2">
                {[
                  { icon: Power, text: "Power off device completely — hold Power 10 s, wait 5 s after screen goes black" },
                  { icon: Usb,   text: "Hold Volume Down button — keep holding it" },
                  { icon: Zap,   text: "While holding Volume Down, plug USB cable into your PC" },
                  { icon: Terminal, text: 'Screen stays BLACK — check Device Manager for "MTK USB Port"' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3 h-3 text-cyan-400" />
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              {/* Device list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Detected Devices</p>
                  <button onClick={() => refetchDevices()}
                    className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors">
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>
                {!devices || devices.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
                    <Loader2 className="w-3.5 h-3.5 text-zinc-600 animate-spin shrink-0" />
                    <span className="text-xs text-zinc-500">Scanning for connected devices...</span>
                  </div>
                ) : (
                  devices.map(d => (
                    <button key={d.id} onClick={() => { setSelectedDevice(d); setStep(2); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:border-cyan-500/40 hover:bg-cyan-500/5 ${
                        selectedDevice?.id === d.id ? "border-cyan-500/40 bg-cyan-500/5" : "border-zinc-800 bg-zinc-900/30"
                      }`}>
                      <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{d.brand} {d.model}</p>
                        <p className="text-xs text-zinc-500 font-mono">{d.serialNumber} · {d.chipset}</p>
                      </div>
                      <Badge className={`shrink-0 text-[10px] font-mono ${
                        d.status === "online" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-zinc-700/40 text-zinc-500 border-zinc-700"}`}>
                        {d.status.toUpperCase()}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
                    </button>
                  ))
                )}
              </div>

              {devices && devices.length > 0 && !selectedDevice && (
                <p className="text-xs text-cyan-400 font-mono">↑ Click your device to continue</p>
              )}
            </div>
          </StepCard>

          {/* ── Step 2: Remove plugins ── */}
          <StepCard n={3} icon={Shield} title="Remove Security Plugins"
            subtitle={selectedDevice ? `${selectedDevice.brand} ${selectedDevice.model} — removing carrier lock & MDM packages` : "Select a device first"}
            status={step < 2 ? "waiting" : step === 2 ? "active" : "done"}>

            {step >= 2 && (
              <div className="space-y-3">
                {plugins.length === 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-zinc-800">
                    <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                    <span className="text-xs text-zinc-500">Loading plugin list for {selectedDevice?.brand}...</span>
                  </div>
                )}

                {plugins.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-mono text-zinc-500">
                        {plugins.filter(p => pluginStates[p.packageName] === "done").length}/{plugins.length} removed
                      </p>
                      {!allPluginsDone && (
                        <Button size="sm" onClick={removeAllPlugins} disabled={opRunning}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-mono h-7 gap-1.5">
                          {opRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                          REMOVE ALL
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {plugins.map(p => (
                        <PluginRow
                          key={p.packageName}
                          plugin={p}
                          state={pluginStates[p.packageName] ?? "pending"}
                          logs={pluginLogs[p.packageName] ?? []}
                          onRemove={() => removePlugin(p.packageName)}
                        />
                      ))}
                    </div>

                    {allPluginsDone && (
                      <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold gap-2"
                        onClick={() => setStep(3)}>
                        Continue to DMD Clear <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </StepCard>

          {/* ── Step 3: DMD ── */}
          <StepCard n={4} icon={HardDrive} title="Clear DMD Lock Database"
            subtitle="Wipes DMD lock entries and disables the lock daemon"
            status={step < 3 ? "waiting" : step === 3 ? "active" : "done"}>

            {step >= 3 && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1.5 text-xs text-zinc-400">
                  {["Force-stop DMD service", "Clear app data (/data/data/com.transsion.dmd)", "Remove lock DB from /data/misc/dmd", "Disable DMD service from auto-starting"].map(s => (
                    <div key={s} className="flex items-center gap-2">
                      {dmdState === "done" ? <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" /> : <div className="w-3 h-3 rounded-full border border-zinc-700 shrink-0" />}
                      <span>{s}</span>
                    </div>
                  ))}
                </div>

                {dmdState === "idle" && (
                  <Button className="w-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 font-mono font-bold gap-2"
                    onClick={runDmd}>
                    <HardDrive className="w-4 h-4" /> CLEAR DMD LOCK
                  </Button>
                )}
                {dmdState === "running" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                    <span className="text-sm text-cyan-300">Clearing DMD lock database...</span>
                  </div>
                )}

                <MiniConsole logs={dmdLogs} />

                {dmdState === "done" && (
                  <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold gap-2"
                    onClick={() => setStep(4)}>
                    Continue to MISC Clear <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
                {dmdState === "error" && (
                  <Button variant="outline" onClick={runDmd}
                    className="w-full border-zinc-700 text-zinc-300 font-mono gap-2">
                    <RotateCcw className="w-3.5 h-3.5" /> Retry DMD Clear
                  </Button>
                )}
              </div>
            )}
          </StepCard>

          {/* ── Step 4: MISC ── */}
          <StepCard n={5} icon={Cpu} title="Clear MISC Partition Lock Flags"
            subtitle="Zeroes out carrier/AVB/seal lock bytes at partition offset 0x200"
            status={step < 4 ? "waiting" : step === 4 ? "active" : "done"}>

            {step >= 4 && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1.5">
                  {["Read current MISC partition (xxd hex dump)", "Zero out lock bytes at offset 0x200 (64 bytes)", "Verify write (re-read and compare)", "Device ready to reboot clean"].map(s => (
                    <div key={s} className="flex items-center gap-2">
                      {miscState === "done" ? <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" /> : <div className="w-3 h-3 rounded-full border border-zinc-700 shrink-0" />}
                      <span>{s}</span>
                    </div>
                  ))}
                </div>

                {miscState === "idle" && (
                  <Button className="w-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 font-mono font-bold gap-2"
                    onClick={runMisc}>
                    <Cpu className="w-4 h-4" /> CLEAR MISC LOCK FLAGS
                  </Button>
                )}
                {miscState === "running" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                    <span className="text-sm text-cyan-300">Writing MISC partition...</span>
                  </div>
                )}

                <MiniConsole logs={miscLogs} />

                {miscState === "done" && (
                  <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold gap-2"
                    onClick={() => setStep(5)}>
                    View Results <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
                {miscState === "error" && (
                  <Button variant="outline" onClick={runMisc}
                    className="w-full border-zinc-700 text-zinc-300 font-mono gap-2">
                    <RotateCcw className="w-3.5 h-3.5" /> Retry MISC Clear
                  </Button>
                )}
              </div>
            )}
          </StepCard>

          {/* ── Step 5: Done ── */}
          {step === 5 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white font-mono">REMOVAL COMPLETE</h2>
                <p className="text-zinc-400 text-sm mt-1">
                  {selectedDevice?.brand} {selectedDevice?.model} — security plugins removed, DMD cleared, MISC partition cleaned
                </p>
              </div>
              <div className="text-left bg-zinc-900/60 rounded-lg border border-zinc-800 p-4 space-y-2">
                <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-3">Summary</p>
                {[
                  { label: "Security plugins removed", value: `${plugins.filter(p => pluginStates[p.packageName] === "done").length} / ${plugins.length}` },
                  { label: "DMD lock database",        value: dmdState === "done"  ? "Cleared" : "Skipped" },
                  { label: "MISC lock flags",          value: miscState === "done" ? "Zeroed"  : "Skipped" },
                  { label: "Device",                   value: `${selectedDevice?.brand} ${selectedDevice?.model}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">{label}</span>
                    <span className="text-emerald-400 font-mono text-xs">{value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => { setStep(0); setSelectedDevice(null); setPlugins([]); setPluginStates({}); setPluginLogs({}); setDmdState("idle"); setMiscState("idle"); }}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold gap-2">
                  <RotateCcw className="w-4 h-4" /> Process Another Device
                </Button>
                <Button variant="outline" onClick={() => navigate("/devices")}
                  className="border-zinc-700 text-zinc-300 hover:text-white font-mono gap-2">
                  View Devices <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-zinc-600">
                ⚡ Reboot the device to complete the process. The security plugins will not reload after reboot.
              </p>
            </div>
          )}

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
