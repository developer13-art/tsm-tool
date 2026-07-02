import { useState } from "react";
import { Layout } from "@/components/layout";
import { ProtectedRoute } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Usb, Terminal, Shield, Smartphone, CheckCircle, Copy,
  AlertTriangle, ChevronRight, BookOpen, HardDrive,
  Cpu, Key, PlugZap, Trash2, Eye, Power, Zap, Radio
} from "lucide-react";

type Protocol = "brom" | "edl" | "fastboot";

const PROTOCOL_TABS: { id: Protocol; label: string; chip: string; icon: typeof Power; color: string; activeColor: string }[] = [
  {
    id: "brom",
    label: "MTK BROM",
    chip: "MediaTek (Helio G91 / G85 / G100 / Dimensity)",
    icon: Cpu,
    color: "border-orange-500/20 bg-orange-500/5",
    activeColor: "border-orange-500 bg-orange-500/15 text-orange-300",
  },
  {
    id: "edl",
    label: "Qualcomm EDL",
    chip: "Snapdragon (SDM480 / 7s Gen2 / 695 / 888)",
    icon: Radio,
    color: "border-red-500/20 bg-red-500/5",
    activeColor: "border-red-500 bg-red-500/15 text-red-300",
  },
  {
    id: "fastboot",
    label: "Fastboot",
    chip: "All chipsets — bootloader mode",
    icon: Zap,
    color: "border-cyan-500/20 bg-cyan-500/5",
    activeColor: "border-cyan-500 bg-cyan-500/15 text-cyan-300",
  },
];

const PROTOCOL_STEPS: Record<Protocol, { title: string; steps: string[]; warning?: string }[]> = {
  brom: [
    {
      title: "Power off the device completely",
      steps: [
        "Hold the **Power button** for 8–10 seconds until the screen goes fully black",
        "Wait 5 seconds after the screen turns off to ensure a clean power-off",
        "Do NOT leave the device in fastboot or recovery — must be fully off",
      ],
    },
    {
      title: "Enter BROM mode (no OS required)",
      steps: [
        "For **Tecno Spark 40 KM5 / Spark 30 / Camon 30** (Helio G91): hold **Volume Down** while plugging in USB",
        "For **Tecno older models (Helio G85)**: hold **both Volume Up + Volume Down**, then plug USB",
        "For **Infinix HOT / NOTE series**: hold **Volume Down + Power** briefly, then plug USB",
        "The device screen stays **completely black** — this is normal in BROM mode",
        "On your PC: Device Manager shows a new **MTK USB Port** or **MediaTek PreLoader** device",
      ],
      warning: "If the screen lights up or boots — you missed BROM. Power off again and retry. BROM only triggers within ~2 seconds of plugging the cable.",
    },
    {
      title: "Install MediaTek VCOM drivers (first time only)",
      steps: [
        "Windows: Device Manager → right-click unknown device → Update Driver",
        "Point to **MTK VCOM USB Drivers** (available from the Local Agent page)",
        "Linux: No driver needed, the kernel FTDI/VCOM module handles it automatically",
        "macOS: Install the **MTK USB Serial Driver** package",
        "After driver installs: Device Manager shows **MTK USB Port (COM X)**",
      ],
    },
    {
      title: "Start the TSM Agent — device auto-detected",
      steps: [
        "Run: `python tsm_agent.py --server <SERVER_URL> --token <TOKEN>`",
        "Agent scans for BROM devices via the MediaTek SP protocol",
        "Device is listed in TSM Pro as **BROM** mode with chip ID automatically read",
        "No Android, no ADB, no USB debugging needed at any point",
      ],
    },
  ],

  edl: [
    {
      title: "Power off the device completely",
      steps: [
        "Hold **Power** for 8–10 seconds until screen goes black",
        "Wait 5 seconds after power-off",
        "Battery-removable devices: remove and reinsert battery then do NOT power on",
      ],
    },
    {
      title: "Enter EDL (9008) mode",
      steps: [
        "Method A — **Volume buttons**: hold **Volume Up + Volume Down**, then plug USB (most Xiaomi/Poco/Realme)",
        "Method B — **Test point short**: locate the EDL test point on the PCB, short it to ground while plugging USB (hardware-level — always works)",
        "Method C — **ADB command** (only if device is already connected): `adb reboot edl`",
        "PC recognizes it as **QHUSB_BULK** (VID:05C6 PID:9008) in Device Manager",
        "Screen stays **black** — correct behavior in EDL",
      ],
      warning: "Some Xiaomi devices lock EDL with an auth token after Android 9+. TSM handles auth-token bypass automatically for supported models.",
    },
    {
      title: "Install Qualcomm 9008 drivers (first time only)",
      steps: [
        "Device Manager should show **Qualcomm HS-USB QDLoader 9008**",
        "If it shows as unknown: install **Qualcomm USB Composite Device drivers**",
        "On Linux: add udev rule for VID 05C6 — no driver needed otherwise",
        "After install: VID:05C6 PID:9008 is visible and accessible",
      ],
    },
    {
      title: "Start the TSM Agent — device auto-detected",
      steps: [
        "Run: `python tsm_agent.py --server <SERVER_URL> --token <TOKEN>`",
        "Agent detects 9008 device via pyserial/pyusb, reads device info automatically",
        "Device appears in TSM Pro in **EDL** mode with Snapdragon SoC info",
      ],
    },
  ],

  fastboot: [
    {
      title: "Reboot the device into Fastboot",
      steps: [
        "Method A — **Button combo**: power off → hold **Volume Down + Power** simultaneously for 5 seconds",
        "Method B — **From Android** (if booted): Settings → Developer Options → Reboot to Bootloader",
        "Method C — **TSM Pro UI**: in the Device list, click **REBOOT** → choose **Fastboot** (requires the device was previously connected)",
        "Screen shows **FASTBOOT MODE** or the Android robot icon",
      ],
    },
    {
      title: "Connect USB — recognized immediately",
      steps: [
        "Plug USB cable while device is in Fastboot screen",
        "Windows: Device Manager shows **Android Bootloader Interface**",
        "Run: `fastboot devices` to confirm — you'll see the serial number",
        "No ADB, no USB debugging, no OS boot needed",
      ],
    },
    {
      title: "Start the TSM Agent",
      steps: [
        "Run: `python tsm_agent.py --server <SERVER_URL> --token <TOKEN>`",
        "Agent detects fastboot devices automatically",
        "Device appears in TSM Pro as **Fastboot** mode",
        "From Fastboot, TSM can reboot to BROM/EDL for deeper access if needed",
      ],
    },
  ],
};

const REMOVE_GUIDE = [
  {
    n: "01",
    title: "Enter BROM / EDL / Fastboot mode",
    desc: "Power off the device. Hold the correct button combo for your chipset. Connect USB cable. No Android boot or USB debugging needed.",
    icon: Power,
  },
  {
    n: "02",
    title: "Agent detects the device",
    desc: "The TSM Agent running on your PC automatically finds the device via its low-level USB protocol and registers it in TSM Pro.",
    icon: Smartphone,
  },
  {
    n: "03",
    title: "Open Device Detail → Security Plugins tab",
    desc: "Click the device row. Go to the Security Plugins tab — TSM loads the brand-specific plugin list for Tecno, Infinix, Samsung, or Xiaomi.",
    icon: Eye,
  },
  {
    n: "04",
    title: "Remove Carrier Lock & Security packages",
    desc: "Click REMOVE on each critical package: com.transsion.carlockservice, com.transsion.dmd, com.tecno.sealapp. Console streams the live output.",
    icon: Trash2,
  },
  {
    n: "05",
    title: "Clear DMD lock database",
    desc: "Go to DMD tab → 'Clear DMD Lock' wipes the lock entries in the DMD database. Then 'Disable DMD Service' permanently kills the daemon.",
    icon: HardDrive,
  },
  {
    n: "06",
    title: "Zero out MISC partition lock flags",
    desc: "MISC tab → 'Clear Lock Flags' writes zeros to the carrier/AVB/seal lock bytes at partition offset 0x200. Reboot normally.",
    icon: Cpu,
  },
];

const VERIFY_COMMANDS: [string, string][] = [
  ["Check connected fastboot devices", "fastboot devices"],
  ["Check connected ADB devices (normal mode only)", "adb devices -l"],
  ["Read MISC partition (first 512 bytes hex)", "adb shell 'dd if=/dev/block/by-name/misc bs=512 count=1 2>/dev/null | xxd'"],
  ["List Transsion/Tecno packages (if in normal Android)", "adb shell pm list packages | grep -iE 'transsion|tecno|dmd|lock|seal'"],
  ["Disable a package without uninstalling", "adb shell pm disable-user --user 0 com.transsion.carlockservice"],
  ["Force uninstall a package", "adb shell pm uninstall --user 0 com.transsion.carlockservice"],
  ["Reboot from ADB to EDL (Qualcomm only)", "adb reboot edl"],
  ["Reboot from ADB to Fastboot", "adb reboot bootloader"],
  ["Fastboot — read partition info", "fastboot getvar all"],
  ["Fastboot — erase a partition", "fastboot erase misc"],
];

function CodeBlock({ code }: { code: string }) {
  const { toast } = useToast();
  const copy = () => { navigator.clipboard.writeText(code); toast({ title: "Copied" }); };
  return (
    <div className="flex items-center gap-2 bg-zinc-950 rounded px-3 py-2 border border-zinc-800 group mt-1">
      <code className="flex-1 font-mono text-xs text-emerald-400 break-all">{code}</code>
      <button onClick={copy} className="text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function renderStep(step: string) {
  const parts = step.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="text-white font-semibold">{part}</strong>
      : <span key={i}>{part}</span>
  );
}

export default function Guide() {
  const [protocol, setProtocol] = useState<Protocol>("brom");
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const steps = PROTOCOL_STEPS[protocol];
  const tab = PROTOCOL_TABS.find(t => t.id === protocol)!;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-3xl space-y-10">

          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white font-mono tracking-wide">CONNECTION GUIDE</h1>
                <p className="text-xs text-zinc-500 font-mono">NO USB DEBUGGING REQUIRED · LOW-LEVEL ACCESS</p>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-200">
                TSM Pro connects via <strong>MTK BROM, Qualcomm EDL, or Fastboot</strong> — low-level hardware protocols that work
                even when the device won't boot. No Developer Options, no USB Debugging, no Android OS required.
              </p>
            </div>
          </div>

          {/* Protocol selector */}
          <div>
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">Select your device chipset / protocol</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PROTOCOL_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setProtocol(t.id); setExpandedStep(0); }}
                  className={`text-left p-3 rounded-lg border transition-all ${protocol === t.id ? t.activeColor : "border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/60"}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <t.icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-mono font-bold">{t.label}</span>
                  </div>
                  <p className="text-[11px] leading-tight opacity-70">{t.chip}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Steps for selected protocol */}
          <div>
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Usb className="w-4 h-4" /> {tab.label} — Step by Step
            </h2>
            <div className="space-y-2">
              {steps.map((step, idx) => {
                const isOpen = expandedStep === idx;
                return (
                  <div key={idx} className={`rounded-lg border transition-all ${isOpen ? tab.color + " border-opacity-70" : "border-zinc-800 bg-zinc-900/20"}`}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      onClick={() => setExpandedStep(isOpen ? null : idx)}
                    >
                      <span className="text-xs font-mono font-bold w-6 shrink-0" style={{ color: protocol === "brom" ? "#f97316" : protocol === "edl" ? "#f87171" : "#22d3ee" }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 text-sm font-medium text-white">{step.title}</span>
                      <ChevronRight className={`w-4 h-4 text-zinc-600 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3">
                        {step.warning && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-200">{step.warning}</p>
                          </div>
                        )}
                        <ol className="space-y-2">
                          {step.steps.map((s, i) => {
                            const isCode = s.startsWith("`") && s.endsWith("`");
                            return (
                              <li key={i} className="flex items-start gap-2.5">
                                <span className="text-xs font-mono text-zinc-600 w-5 shrink-0 mt-0.5">{i + 1}.</span>
                                {isCode
                                  ? <CodeBlock code={s.slice(1, -1)} />
                                  : <p className="text-sm text-zinc-300 leading-relaxed">{renderStep(s)}</p>
                                }
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Generate token section */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-mono font-semibold text-purple-300 uppercase tracking-wider">Generate your Agent Token</h2>
            </div>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li><span className="font-mono text-purple-400 text-xs mr-2">1.</span>Open <strong className="text-white">Settings</strong> in the sidebar</li>
              <li><span className="font-mono text-purple-400 text-xs mr-2">2.</span>Scroll to <strong className="text-white">API Tokens</strong> → enter a name → click <strong className="text-white">GENERATE</strong></li>
              <li><span className="font-mono text-purple-400 text-xs mr-2">3.</span>Copy the token — shown only once</li>
              <li><span className="font-mono text-purple-400 text-xs mr-2">4.</span>Pass it to the agent:</li>
            </ol>
            <CodeBlock code="python tsm_agent.py --server https://your-app.replit.app --token tsm_xxxxx" />
          </div>

          {/* How TSM removes plugins */}
          <div>
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" /> How to Remove Security Plugins via TSM Pro
            </h2>
            <div className="space-y-2">
              {REMOVE_GUIDE.map((step) => (
                <div key={step.n} className="flex items-start gap-4 p-4 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 transition-colors">
                  <span className="text-xs font-mono text-cyan-500 font-bold shrink-0 mt-0.5">{step.n}</span>
                  <step.icon className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">{step.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verify commands */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
            <h2 className="text-sm font-mono font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" /> Useful Commands Reference
            </h2>
            <p className="text-xs text-zinc-500">These are for advanced use or manual verification when the agent is already running:</p>
            <div className="space-y-3">
              {VERIFY_COMMANDS.map(([label, cmd]) => (
                <div key={cmd}>
                  <p className="text-[11px] font-mono text-zinc-500 uppercase tracking-wide">{label}</p>
                  <CodeBlock code={cmd} />
                </div>
              ))}
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-mono font-semibold text-yellow-300 uppercase tracking-wider">Troubleshooting</h2>
            </div>
            <div className="space-y-5">
              {[
                {
                  problem: "Device not detected in BROM mode (MTK)",
                  solutions: [
                    "Make sure device is fully powered off (not just screen off)",
                    "Try a different USB port — use USB 2.0, not USB 3.0",
                    "Hold Volume Down BEFORE plugging in — timing is critical (within 1–2 seconds)",
                    "Install MTK VCOM USB drivers from the Local Agent page",
                    "On Windows: Device Manager → Ports (COM & LPT) → look for MTK USB Port",
                  ],
                },
                {
                  problem: "Device not detected in EDL mode (Qualcomm 9008)",
                  solutions: [
                    "Device Manager shows VID:05C6 PID:9008 — install Qualcomm QDLoader 9008 drivers",
                    "If no device at all: try the PCB test-point short method",
                    "Xiaomi auth-locked EDL: TSM handles bypass for supported models automatically",
                    "Ensure BIOS USB Legacy Support is enabled (some UEFI systems block 9008)",
                  ],
                },
                {
                  problem: "Fastboot not detecting device",
                  solutions: [
                    "Run: fastboot devices — if blank, reinstall Android platform tools",
                    "Windows: Device Manager → Android Bootloader Interface — install Google USB drivers",
                    "Try a different cable — fastboot needs full data cable, not charge-only",
                  ],
                },
                {
                  problem: "Tecno Spark 40 KM5 — specific tips",
                  solutions: [
                    "Chipset: Helio G91 (MediaTek) — use MTK BROM protocol",
                    "BROM combo: Volume Down held → plug USB → screen stays black",
                    "After removal, clear MISC partition lock byte at offset 0x200",
                    "If DMD service re-enables after reboot: use TSM DMD tab → 'Disable DMD Service' then MISC Clear",
                  ],
                },
              ].map(t => (
                <div key={t.problem} className="space-y-2">
                  <p className="text-sm font-medium text-yellow-200">⚠ {t.problem}</p>
                  <ul className="space-y-1 pl-3">
                    {t.solutions.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                        <span className="text-zinc-600 shrink-0">→</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

        </div>
      </Layout>
    </ProtectedRoute>
  );
}
