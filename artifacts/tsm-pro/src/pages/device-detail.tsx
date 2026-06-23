import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/lib/auth";
import { useGetDevice, useListMdmPackages, useCreateJob } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Smartphone, Cpu, Wifi, Shield, HardDrive,
  AlertTriangle, CheckCircle, XCircle, Loader2, RefreshCw,
  Play, Eye, Trash2, Database, MemoryStick, Key
} from "lucide-react";

type OpStatus = "idle" | "running" | "completed" | "failed";

interface OpLog {
  id: number;
  level: string;
  message: string;
  createdAt: string;
}

interface OpResult {
  id: number;
  status: string;
  outputData?: Record<string, unknown>;
}

interface Plugin {
  packageName: string;
  displayName: string;
  description: string;
  severity: "critical" | "high" | "medium";
}

function LogLine({ level, message }: { level: string; message: string }) {
  const colorMap: Record<string, string> = {
    success: "text-emerald-400",
    error: "text-red-400",
    warning: "text-yellow-400",
    debug: "text-zinc-500",
    info: "text-zinc-300",
  };
  const color = colorMap[level] ?? "text-zinc-300";
  return <div className={`font-mono text-xs leading-5 ${color} whitespace-pre-wrap`}>{message}</div>;
}

function OpConsole({ opId, onDone }: { opId: number | null; onDone?: (result: OpResult) => void }) {
  const [logs, setLogs] = useState<OpLog[]>([]);
  const [status, setStatus] = useState<string>("running");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!opId) return;
    setLogs([]);
    setStatus("running");

    const poll = async () => {
      try {
        const resp = await fetch(`/api/devices/0/operations/${opId}/logs`, { credentials: "include" });
        if (!resp.ok) return;
        const data = await resp.json();
        setLogs(data.logs ?? []);
        setStatus(data.op?.status ?? "running");
        if (data.op?.status === "completed" || data.op?.status === "failed") {
          onDone?.(data.op);
        }
      } catch { /* ignore */ }
    };

    poll();
    const iv = setInterval(poll, 1500);
    return () => clearInterval(iv);
  }, [opId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!opId) return null;

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs font-mono text-zinc-500">
        <div className={`w-2 h-2 rounded-full ${status === "running" ? "bg-yellow-500 animate-pulse" : status === "completed" ? "bg-emerald-500" : "bg-red-500"}`} />
        <span>OPERATION CONSOLE</span>
        <span className="ml-auto">{status.toUpperCase()}</span>
      </div>
      <div className="p-4 max-h-72 overflow-y-auto space-y-0.5">
        {logs.length === 0 && status === "running" && (
          <div className="text-zinc-600 font-mono text-xs animate-pulse">Initializing...</div>
        )}
        {logs.map(log => <LogLine key={log.id} level={log.level} message={log.message} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function SecurityTab({ deviceId, brand }: { deviceId: number; brand: string }) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [activeOpId, setActiveOpId] = useState<number | null>(null);
  const [removedPkgs, setRemovedPkgs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/devices/${deviceId}/plugins`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setPlugins(d.plugins ?? []))
      .catch(() => {});
  }, [deviceId]);

  const runRemoval = async (plugin: Plugin) => {
    const resp = await fetch(`/api/devices/${deviceId}/operations`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationType: "security_removal", inputData: { packageName: plugin.packageName, displayName: plugin.displayName } }),
    });
    if (!resp.ok) { toast({ variant: "destructive", title: "Failed to start operation" }); return; }
    const op = await resp.json();
    setActiveOpId(op.id);
  };

  const severityColor = (s: string) => s === "critical" ? "border-red-500 text-red-400 bg-red-500/10" : s === "high" ? "border-orange-500 text-orange-400 bg-orange-500/10" : "border-yellow-500 text-yellow-400 bg-yellow-500/10";

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">Detected security plugins and MDM agents for <span className="text-white font-medium">{brand}</span> devices. Select a package to remove it via ADB.</p>
      <div className="space-y-2">
        {plugins.map(p => (
          <div key={p.packageName} className={`flex items-start gap-3 p-3 rounded-lg border ${removedPkgs.has(p.packageName) ? "border-zinc-800 opacity-40" : "border-zinc-800 bg-zinc-900/40"} hover:bg-zinc-900/80 transition-colors`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white">{p.displayName}</span>
                <Badge variant="outline" className={`font-mono text-[10px] rounded-sm ${severityColor(p.severity)}`}>{p.severity.toUpperCase()}</Badge>
              </div>
              <code className="text-[11px] text-cyan-500 font-mono">{p.packageName}</code>
              <p className="text-xs text-zinc-500 mt-0.5">{p.description}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={removedPkgs.has(p.packageName)}
              onClick={() => runRemoval(p)}
              className="shrink-0 font-mono text-xs border-zinc-700 hover:border-red-500 hover:text-red-400"
            >
              {removedPkgs.has(p.packageName) ? <><CheckCircle className="w-3 h-3 mr-1" />REMOVED</> : <><Trash2 className="w-3 h-3 mr-1" />REMOVE</>}
            </Button>
          </div>
        ))}
      </div>
      <OpConsole opId={activeOpId} onDone={(res) => {
        if (res.status === "completed" && res.outputData?.removed) {
          setRemovedPkgs(prev => new Set([...prev, res.outputData!.removed as string]));
          toast({ title: "Package removed successfully" });
        }
      }} />
    </div>
  );
}

function DmdTab({ deviceId, brand }: { deviceId: number; brand: string }) {
  const [activeOpId, setActiveOpId] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<OpResult | null>(null);
  const { toast } = useToast();

  const runOp = async (type: string) => {
    setActiveOpId(null);
    const resp = await fetch(`/api/devices/${deviceId}/operations`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationType: type }),
    });
    if (!resp.ok) { toast({ variant: "destructive", title: "Failed to start operation" }); return; }
    const op = await resp.json();
    setTimeout(() => setActiveOpId(op.id), 50);
  };

  const isTecnoVariant = ["tecno", "infinix", "itel"].includes(brand.toLowerCase());

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-orange-300">Device Management Daemon (DMD)</p>
            <p className="text-xs text-zinc-400 mt-1">
              {isTecnoVariant
                ? "Transsion DMD (com.transsion.dmd) manages carrier and financing locks. Clearing or disabling it removes all software-enforced device locks."
                : "The DMD service controls remote lock enforcement. Operations below interact with the lock database."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { type: "dmd_read", label: "Read DMD Status", desc: "Check current lock state and active entries", icon: Eye, color: "border-cyan-500/30 hover:border-cyan-400" },
          { type: "dmd_dump", label: "Dump DMD Database", desc: "Extract all tables and lock entries", icon: Database, color: "border-blue-500/30 hover:border-blue-400" },
          { type: "dmd_clear", label: "Clear DMD Lock", desc: "Remove all lock entries from database", icon: Trash2, color: "border-red-500/30 hover:border-red-400" },
          { type: "dmd_disable", label: "Disable DMD Service", desc: "Permanently disable DMD + carrier lock service", icon: XCircle, color: "border-red-500/30 hover:border-red-400" },
        ].map(op => (
          <button
            key={op.type}
            onClick={() => runOp(op.type)}
            className={`flex items-start gap-3 p-4 rounded-lg border text-left bg-zinc-900/40 hover:bg-zinc-900/80 transition-all ${op.color}`}
          >
            <op.icon className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">{op.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{op.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <OpConsole opId={activeOpId} onDone={(res) => {
        setLastResult(res);
        if (res.status === "completed") toast({ title: "DMD operation completed" });
      }} />
    </div>
  );
}

function MiscTab({ deviceId, brand }: { deviceId: number; brand: string }) {
  const [activeOpId, setActiveOpId] = useState<number | null>(null);
  const [bcbCommand, setBcbCommand] = useState("boot-recovery");
  const [bcbPayload, setBcbPayload] = useState("--wipe_data");
  const { toast } = useToast();

  const runOp = async (type: string, inputData?: Record<string, unknown>) => {
    setActiveOpId(null);
    const resp = await fetch(`/api/devices/${deviceId}/operations`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operationType: type, inputData }),
    });
    if (!resp.ok) { toast({ variant: "destructive", title: "Failed to start operation" }); return; }
    const op = await resp.json();
    setTimeout(() => setActiveOpId(op.id), 50);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="text-sm font-medium text-zinc-300 mb-1">MISC Partition</p>
        <p className="text-xs text-zinc-500">
          The MISC partition stores the Bootloader Control Block (BCB), AVB metadata, and OEM-specific lock flags.
          Reading or writing this partition requires root/ADB access.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => runOp("misc_read")}
          className="flex items-start gap-3 p-4 rounded-lg border border-cyan-500/30 text-left bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-cyan-400 transition-all"
        >
          <Eye className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">Read MISC Partition</p>
            <p className="text-xs text-zinc-500 mt-0.5">Dump hex content — BCB, AVB flags, lock bytes</p>
          </div>
        </button>
        <button
          onClick={() => runOp("misc_clear_lock")}
          className="flex items-start gap-3 p-4 rounded-lg border border-red-500/30 text-left bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-red-400 transition-all"
        >
          <Trash2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-white">Clear Lock Flags</p>
            <p className="text-xs text-zinc-500 mt-0.5">Zero out lock bytes at offset 0x200 — carrier/seal/AVB</p>
          </div>
        </button>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
        <p className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-wider">Write BCB</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs text-zinc-400">COMMAND</Label>
            <select
              value={bcbCommand}
              onChange={e => setBcbCommand(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-white font-mono text-sm rounded-md px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              <option value="boot-recovery">boot-recovery</option>
              <option value="recovery">recovery</option>
              <option value="bootonce-bootloader">bootonce-bootloader</option>
              <option value="">clear (empty)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs text-zinc-400">RECOVERY ARGS (optional)</Label>
            <Input
              value={bcbPayload}
              onChange={e => setBcbPayload(e.target.value)}
              className="font-mono bg-zinc-900 border-zinc-700 text-sm"
              placeholder="--wipe_data"
            />
          </div>
        </div>
        <Button
          onClick={() => runOp("misc_write", { command: bcbCommand, payload: bcbPayload })}
          className="font-mono text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30"
          variant="outline"
        >
          <HardDrive className="w-4 h-4 mr-2" />
          WRITE BCB TO MISC
        </Button>
      </div>

      <OpConsole opId={activeOpId} onDone={() => toast({ title: "MISC operation completed" })} />
    </div>
  );
}

function MdmTab({ deviceId }: { deviceId: number }) {
  const { data: packages } = useListMdmPackages();
  const createJob = useCreateJob();
  const [selectedPkg, setSelectedPkg] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const dispatch = () => {
    if (!selectedPkg) return;
    createJob.mutate(
      { data: { deviceId, packageId: selectedPkg, notes: notes || undefined } },
      {
        onSuccess: (job) => {
          toast({ title: "Job dispatched", description: `Job #${job.id} created` });
          navigate(`/jobs/${job.id}`);
        },
        onError: () => toast({ variant: "destructive", title: "Failed to create job" }),
      }
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">Select an MDM package to remove from this device. A job will be created and dispatched to the local agent.</p>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {packages?.map(pkg => (
          <button
            key={pkg.id}
            onClick={() => setSelectedPkg(pkg.id === selectedPkg ? null : pkg.id)}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${selectedPkg === pkg.id ? "border-cyan-500 bg-cyan-500/10" : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80"}`}
          >
            <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${selectedPkg === pkg.id ? "border-cyan-500 bg-cyan-500" : "border-zinc-600"}`} />
            <div>
              <p className="text-sm font-medium text-white">{pkg.displayName}</p>
              <code className="text-[11px] text-cyan-500 font-mono">{pkg.packageName}</code>
              <p className="text-xs text-zinc-500 mt-0.5">{pkg.vendor}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="font-mono text-xs text-zinc-400">NOTES (optional)</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Technician notes..." className="font-mono bg-zinc-900 border-zinc-700 text-sm" />
      </div>
      <Button
        onClick={dispatch}
        disabled={!selectedPkg || createJob.isPending}
        className="font-mono bg-cyan-500 text-black hover:bg-cyan-400 font-bold"
      >
        {createJob.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />DISPATCHING...</> : <><Play className="w-4 h-4 mr-2" />DISPATCH JOB</>}
      </Button>
    </div>
  );
}

export default function DeviceDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id ?? "0");
  const { data: device, isLoading } = useGetDevice({ id });

  if (isLoading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!device) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center p-12 text-zinc-500">
            <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-mono">DEVICE NOT FOUND</p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const statusColor = device.status === "online" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
    : device.status === "busy" ? "border-yellow-500 text-yellow-400 bg-yellow-500/10"
    : device.status === "error" ? "border-red-500 text-red-400 bg-red-500/10"
    : "border-zinc-600 text-zinc-400 bg-zinc-800/50";

  const blColor = device.bootloaderStatus === "unlocked" ? "text-emerald-400" : device.bootloaderStatus === "locked" ? "text-yellow-400" : "text-zinc-500";

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 max-w-5xl">
          <button onClick={() => navigate("/devices")} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-mono">
            <ArrowLeft className="w-4 h-4" /> BACK TO REGISTRY
          </button>

          {/* Device Header */}
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
              <Smartphone className="w-7 h-7 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-white">{device.brand} {device.model}</h1>
                <Badge variant="outline" className={`font-mono text-xs rounded-sm ${statusColor}`}>{device.status.toUpperCase()}</Badge>
                <Badge variant="outline" className="font-mono text-xs rounded-sm border-primary/30 text-primary bg-primary/5">{device.mode.toUpperCase()}</Badge>
              </div>
              <p className="font-mono text-sm text-zinc-500 mt-1">{device.serialNumber}</p>
              <div className="flex flex-wrap gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-zinc-400"><Cpu className="w-3 h-3" />{device.chipset}</span>
                {device.androidVersion && <span className="flex items-center gap-1.5 text-xs text-zinc-400"><Shield className="w-3 h-3" />Android {device.androidVersion}</span>}
                {device.imei && <span className="flex items-center gap-1.5 text-xs text-zinc-400"><Wifi className="w-3 h-3" />IMEI: {device.imei}</span>}
                <span className={`flex items-center gap-1.5 text-xs font-mono ${blColor}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${device.bootloaderStatus === "unlocked" ? "bg-emerald-500" : device.bootloaderStatus === "locked" ? "bg-yellow-500" : "bg-zinc-600"}`} />
                  BL {device.bootloaderStatus.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Operations Tabs */}
          <Tabs defaultValue="security">
            <TabsList className="bg-zinc-900 border border-zinc-800 h-auto flex-wrap">
              <TabsTrigger value="security" className="font-mono text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                <Shield className="w-3.5 h-3.5 mr-1.5" />SECURITY PLUGINS
              </TabsTrigger>
              <TabsTrigger value="dmd" className="font-mono text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                <Database className="w-3.5 h-3.5 mr-1.5" />DMD
              </TabsTrigger>
              <TabsTrigger value="misc" className="font-mono text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                <MemoryStick className="w-3.5 h-3.5 mr-1.5" />MISC PARTITION
              </TabsTrigger>
              <TabsTrigger value="mdm" className="font-mono text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-white">
                <Key className="w-3.5 h-3.5 mr-1.5" />MDM REMOVAL
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-5">
              <TabsContent value="security" className="mt-0">
                <SecurityTab deviceId={id} brand={device.brand} />
              </TabsContent>
              <TabsContent value="dmd" className="mt-0">
                <DmdTab deviceId={id} brand={device.brand} />
              </TabsContent>
              <TabsContent value="misc" className="mt-0">
                <MiscTab deviceId={id} brand={device.brand} />
              </TabsContent>
              <TabsContent value="mdm" className="mt-0">
                <MdmTab deviceId={id} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
