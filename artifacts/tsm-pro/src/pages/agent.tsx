import { useState } from "react";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/lib/auth";
import {
  Download, Terminal, Cpu, Usb, CheckCircle, Copy,
  ChevronRight, Zap, Radio, Shield, HardDrive, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const PROTOCOLS = [
  {
    name: "MTK BROM",
    desc: "MediaTek Boot ROM — Helio G91/G85/G100/Dimensity. Device fully off, holds Volume Down while plugging USB. Screen stays black.",
    icon: "🟠",
    badge: "NO OS NEEDED",
    badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    vid: "0x0E8D",
    pid: "0x2001",
  },
  {
    name: "Qualcomm EDL",
    desc: "Emergency Download Mode (9008). Hold Vol Up + Vol Down then plug USB. Appears as QDLoader in Device Manager.",
    icon: "🔴",
    badge: "NO OS NEEDED",
    badgeColor: "bg-red-500/10 text-red-400 border-red-500/30",
    vid: "0x05C6",
    pid: "0x9008",
  },
  {
    name: "Fastboot",
    desc: "Bootloader mode — Vol Down + Power combo. Screen shows FASTBOOT MODE. Agent reboots to ADB automatically.",
    icon: "⚡",
    badge: "NO OS NEEDED",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    vid: "0x18D1",
    pid: "various",
  },
  {
    name: "ADB",
    desc: "Standard Android Debug Bridge — normal Android mode only. Requires USB Debugging to be enabled on device.",
    icon: "📱",
    badge: "NEEDS ADB",
    badgeColor: "bg-zinc-500/10 text-zinc-400 border-zinc-700",
    vid: "—",
    pid: "—",
  },
  {
    name: "Samsung Heimdall",
    desc: "Download mode for Samsung (Exynos/Snapdragon). Vol Down + Home + Power. VID 0x04E8.",
    icon: "🔵",
    badge: "NO OS NEEDED",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    vid: "0x04E8",
    pid: "0x685D",
  },
];

const OPERATIONS = [
  { icon: Shield, label: "Security Plugin Removal", desc: "Uninstalls carrier lock, DMD, Seal app — Tecno, Samsung, Xiaomi specific package lists" },
  { icon: HardDrive, label: "DMD Lock Database Clear", desc: "Wipes DMD lock entries, clears app data, removes lock DB files from /data/misc/dmd" },
  { icon: RotateCcw, label: "MISC Partition Flags", desc: "Zeroes carrier/seal/AVB lock bytes at offset 0x200 in the MISC partition" },
  { icon: Zap, label: "MTK BROM Handshake", desc: "Real 4-byte sync sequence (0xA0→0x5F…) with Helio G91 bulk endpoints EP1 OUT/IN" },
  { icon: Radio, label: "Qualcomm Sahara Init", desc: "Firehose programmer handshake, partition table read, reboot-to-system" },
];

const SETUP_STEPS = [
  { n: "01", title: "Download both files below", desc: "Get tsm_agent.py and requirements.txt" },
  { n: "02", title: "Install Python 3.10+", desc: 'Verify: python --version  →  should show 3.10 or newer' },
  { n: "03", title: "Install dependencies", desc: "pip install -r requirements.txt  (includes pyusb for MTK BROM/EDL detection)" },
  { n: "04", title: "Install ADB/Fastboot (for ADB mode)", desc: "Android Platform Tools — only needed if using ADB or Fastboot protocols" },
  {
    n: "05", title: "Windows only: install MTK VCOM driver",
    desc: "For BROM mode — Device Manager should show 'MTK USB Port'. Driver link on Connection Guide page.",
  },
  { n: "06", title: "Generate API token", desc: "Settings → API Tokens → enter name → GENERATE → copy immediately" },
  { n: "07", title: "Run the agent", desc: "python tsm_agent.py --server <SERVER_URL> --token <YOUR_TOKEN>" },
];

const SYS_REQS = [
  ["Python", "3.10 or newer"],
  ["pyusb", "1.2.1+ (MTK BROM / EDL USB detection)"],
  ["pyserial", "3.5+ (serial port fallback)"],
  ["ADB", "Platform Tools (ADB/Fastboot modes only)"],
  ["OS", "Windows 10+ / Linux / macOS 12+"],
  ["USB", "USB 2.0 port recommended for BROM/EDL"],
];

function CodeBlock({ code }: { code: string }) {
  const { toast } = useToast();
  const copy = () => { navigator.clipboard.writeText(code); toast({ title: "Copied" }); };
  return (
    <div className="flex items-center gap-2 bg-zinc-950 rounded px-3 py-2 border border-zinc-800 group">
      <code className="flex-1 font-mono text-sm text-emerald-400 break-all">{code}</code>
      <button onClick={copy} className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Agent() {
  const { toast } = useToast();
  const serverUrl = window.location.origin;
  const exampleCmd = `python tsm_agent.py --server ${serverUrl} --token YOUR_API_TOKEN`;

  async function download(path: string, filename: string) {
    try {
      const r = await fetch(`/api${path}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Download failed", description: String(err), variant: "destructive" });
    }
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-4xl space-y-10">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Terminal className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white font-mono tracking-wide">LOCAL AGENT</h1>
                <p className="text-xs text-zinc-500 font-mono">v2.0.0 — MTK BROM · EDL · FASTBOOT · ADB</p>
              </div>
              <Badge className="ml-auto bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-xs">
                STABLE
              </Badge>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed mt-4">
              The TSM Pro Local Agent runs on your PC and connects USB devices directly to this server.
              It supports <strong className="text-white">MTK BROM</strong> (Helio G91/G85) and <strong className="text-white">Qualcomm EDL</strong> via pyusb —
              no USB Debugging or Developer Options required. The agent polls for pending jobs every 5 seconds
              and streams live logs back to TSM Pro.
            </p>
          </div>

          {/* Download buttons */}
          <div className="space-y-3">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Download Agent Files</p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => download("/agent/download", "tsm_agent.py")}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold gap-2"
              >
                <Download className="w-4 h-4" />
                tsm_agent.py
              </Button>
              <Button
                variant="outline"
                onClick={() => download("/agent/requirements", "requirements.txt")}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-mono gap-2"
              >
                <Download className="w-4 h-4" />
                requirements.txt
              </Button>
            </div>
          </div>

          {/* Run command */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Run Command</p>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800/60 border-b border-zinc-800">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                <span className="ml-2 text-xs text-zinc-500 font-mono">terminal</span>
              </div>
              <div className="p-4">
                <CodeBlock code={exampleCmd} />
              </div>
            </div>
          </div>

          {/* Setup steps */}
          <div>
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-widest mb-4">
              Setup Steps
            </h2>
            <div className="space-y-2">
              {SETUP_STEPS.map((step) => (
                <div
                  key={step.n}
                  className="flex items-start gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 transition-colors"
                >
                  <span className="text-xs font-mono text-cyan-500 font-bold shrink-0 mt-0.5">{step.n}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{step.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed font-mono">{step.desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Supported protocols */}
          <div>
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-widest mb-4">
              Supported Protocols
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PROTOCOLS.map((p) => (
                <div key={p.name} className="p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-sm font-mono font-semibold text-white">{p.name}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-mono rounded-sm shrink-0 ${p.badgeColor}`}>
                      {p.badge}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{p.desc}</p>
                  <div className="flex gap-3 pt-1">
                    <span className="text-[10px] font-mono text-zinc-600">VID {p.vid}</span>
                    <span className="text-[10px] font-mono text-zinc-600">PID {p.pid}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent operations */}
          <div>
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-widest mb-4">
              Agent Operations
            </h2>
            <div className="space-y-2">
              {OPERATIONS.map((op) => (
                <div key={op.label} className="flex items-start gap-4 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30">
                  <op.icon className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">{op.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{op.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System requirements */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-widest">
              System Requirements
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SYS_REQS.map(([label, value]) => (
                <div key={label} className="flex gap-2 items-start">
                  <Cpu className="w-3 h-3 text-cyan-500 shrink-0 mt-0.5" />
                  <span className="text-xs font-mono text-zinc-500">
                    <span className="text-zinc-300">{label}:</span> {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick pip install */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Quick Install</p>
            <CodeBlock code="pip install requests pyusb pyserial" />
            <p className="text-xs text-zinc-600 font-mono">
              Windows BROM driver: Device Manager → MTK USB Port should appear when device is in BROM mode
            </p>
          </div>

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
