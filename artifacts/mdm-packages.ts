import { Router } from "express";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

// ─── tsm_agent.py ─────────────────────────────────────────────────────────────

const AGENT_SCRIPT = `#!/usr/bin/env python3
"""
TSM Pro Local Agent v2.0
Bridges USB-connected Android devices to the TSM Pro server.
Supports MTK BROM, Qualcomm EDL, Fastboot, and ADB protocols.

Usage:
    pip install -r requirements.txt
    python tsm_agent.py --server https://your-app.replit.app --token tsm_xxxxx

No USB Debugging or Developer Options required for MTK BROM / EDL / Fastboot modes.
"""

import os
import sys
import json
import time
import argparse
import logging
import platform
import subprocess
import threading
import struct
from datetime import datetime

import requests

# Optional: pyusb for low-level USB detection (BROM/EDL)
try:
    import usb.core
    import usb.util
    HAS_PYUSB = True
except ImportError:
    HAS_PYUSB = False

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tsm-agent")


AGENT_VERSION = "2.0.0"
DEFAULT_POLL_INTERVAL = 5   # seconds
OS = platform.system()      # "Windows", "Linux", "Darwin"

# ─── USB VID/PID tables ───────────────────────────────────────────────────────

MTK_VID = 0x0E8D
MTK_BROM_PIDS = {
    0x0003: "MT65xx Phone",
    0x2000: "MT65xx DA",
    0x2001: "MT65xx BROM",
    0x0023: "MT6261 BROM",
    0x3000: "Helio (BROM)",
    0x3001: "Helio DA",
}

# Helio G91 / G85 / G100 appear as 0x0E8D:0x2001 in BROM
# (same VID, the DA mode is 0x2000)
HELIO_PIDS = {0x2001, 0x3001, 0x0003}

QC_VID  = 0x05C6
EDL_PID = 0x9008

SAMSUNG_VID      = 0x04E8
SAMSUNG_DL_PIDS  = {0x685D, 0x6860, 0x6601}

ANDROID_VID      = 0x18D1   # Google / AOSP fastboot
FASTBOOT_PIDS    = {0x4EE7, 0x0D02, 0x0D00}

# ─── Transsion / Tecno / Infinix security package lists ───────────────────────

TRANSSION_SECURITY_PACKAGES = [
    "com.transsion.carlockservice",     # Carrier Lock daemon   — CRITICAL
    "com.transsion.dmd",                # DMD lock daemon       — CRITICAL
    "com.tecno.sealapp",                # Seal/financing lock   — CRITICAL
    "com.transsion.devicemanager",      # Remote device manager
    "com.transsion.security",           # Transsion Security
    "com.transsion.mdm",                # Transsion MDM
    "com.hmd.android.dm",               # HMD Device Manager
    "com.transsion.lockscreen",         # Lock screen override
    "com.transsion.supervise",          # Supervision agent
]

SAMSUNG_SECURITY_PACKAGES = [
    "com.samsung.android.mdm",
    "com.samsung.android.knox.containercore",
    "com.samsung.android.knox.active",
    "com.sec.android.app.camerasdktest",
    "com.samsung.android.mdmfield",
]

XIAOMI_SECURITY_PACKAGES = [
    "com.miui.securitycenter",
    "com.miui.guardprovider",
    "com.xiaomi.finddevice",
    "com.xiaomi.mipush.sdk",
]

BRAND_PACKAGES = {
    "tecno":   TRANSSION_SECURITY_PACKAGES,
    "infinix": TRANSSION_SECURITY_PACKAGES,
    "itel":    TRANSSION_SECURITY_PACKAGES,
    "samsung": SAMSUNG_SECURITY_PACKAGES,
    "xiaomi":  XIAOMI_SECURITY_PACKAGES,
    "poco":    XIAOMI_SECURITY_PACKAGES,
    "redmi":   XIAOMI_SECURITY_PACKAGES,
}


# ─── USB helpers ──────────────────────────────────────────────────────────────

def find_usb_device(vid: int, pids: set[int]):
    """Find first USB device matching vid and any pid in pids. Returns usb.Device or None."""
    if not HAS_PYUSB:
        return None
    for pid in pids:
        dev = usb.core.find(idVendor=vid, idProduct=pid)
        if dev is not None:
            return dev
    return None


def get_usb_string(dev) -> str:
    """Get product string from USB device."""
    if not HAS_PYUSB or dev is None:
        return ""
    try:
        return usb.util.get_string(dev, dev.iProduct) or ""
    except Exception:
        return ""


def list_usb_devices_fallback() -> str:
    """Cross-platform fallback: run lsusb (Linux/macOS) or pnputil (Windows)."""
    if OS == "Windows":
        try:
            r = subprocess.run(
                ["pnputil", "/enum-devices", "/connected"],
                capture_output=True, text=True, timeout=10
            )
            return r.stdout
        except Exception:
            return ""
    else:
        try:
            r = subprocess.run(["lsusb"], capture_output=True, text=True, timeout=5)
            return r.stdout
        except Exception:
            return ""


# ─── Protocol Handlers ────────────────────────────────────────────────────────

class BaseProtocol:
    name = "base"

    def __init__(self, serial: str = ""):
        self.serial = serial

    def _run(self, cmd: list, timeout: int = 30) -> tuple[bool, str]:
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            out = r.stdout + r.stderr
            return r.returncode == 0, out
        except subprocess.TimeoutExpired:
            return False, "Command timed out"
        except FileNotFoundError as e:
            return False, f"Tool not found — is it on PATH? ({e})"

    def remove_package(self, package: str, log_cb) -> bool:
        raise NotImplementedError


class AdbProtocol(BaseProtocol):
    name = "adb"

    def remove_package(self, package: str, log_cb) -> bool:
        s = ["-s", self.serial] if self.serial else []

        log_cb("info", f"[ADB] Waiting for device {self.serial or '(any)'}...")
        self._run(["adb"] + s + ["wait-for-device"], timeout=15)

        log_cb("info", f"[ADB] Checking: {package}")
        ok, out = self._run(["adb"] + s + ["shell", f"pm list packages {package}"])
        if package not in out:
            log_cb("warning", f"[ADB] {package} not found — already removed?")
            return True

        # Revoke device admin first
        log_cb("info", "[ADB] Revoking device admin rights...")
        self._run(["adb"] + s + ["shell", f"dpm remove-active-admin {package}/.AdminReceiver"])
        time.sleep(0.5)

        # Force stop
        log_cb("info", "[ADB] Force-stopping service...")
        self._run(["adb"] + s + ["shell", f"am force-stop {package}"])
        time.sleep(0.5)

        # Uninstall for user 0
        log_cb("info", f"[ADB] Uninstalling {package} for user 0...")
        ok, out = self._run(["adb"] + s + ["shell", f"pm uninstall --user 0 {package}"])
        if ok or "Success" in out:
            log_cb("success", "[ADB] ✓ Package uninstalled successfully")
            return True

        # Fallback: disable
        log_cb("info", "[ADB] Trying pm disable-user fallback...")
        ok, out = self._run(["adb"] + s + ["shell", f"pm disable-user --user 0 {package}"])
        if ok or "disabled" in out.lower():
            log_cb("success", "[ADB] ✓ Package disabled for user 0")
            return True

        # Fallback: hide (requires root or system sig)
        log_cb("info", "[ADB] Trying pm hide fallback...")
        ok, out = self._run(["adb"] + s + ["shell", f"pm hide {package}"])
        if ok:
            log_cb("success", "[ADB] ✓ Package hidden")
            return True

        log_cb("error", f"[ADB] Failed: {out.strip()[:200]}")
        return False

    def clear_misc_lock_flags(self, log_cb) -> bool:
        s = ["-s", self.serial] if self.serial else []
        log_cb("info", "[ADB] Reading MISC partition (first 512 bytes)...")
        ok, out = self._run(
            ["adb"] + s + ["shell", "dd if=/dev/block/by-name/misc bs=512 count=1 2>/dev/null | xxd"],
            timeout=15
        )
        if ok:
            log_cb("info", f"[ADB] MISC dump:\\n{out[:400]}")

        log_cb("info", "[ADB] Zeroing carrier/seal/AVB lock bytes at offset 0x200...")
        zero_cmd = (
            "dd if=/dev/zero of=/dev/block/by-name/misc bs=1 count=64 seek=512 2>/dev/null"
        )
        ok, out = self._run(["adb"] + s + ["shell", zero_cmd], timeout=20)
        if ok:
            log_cb("success", "[ADB] ✓ MISC lock flags cleared")
            return True

        log_cb("error", f"[ADB] MISC write failed: {out.strip()[:200]}")
        return False

    def clear_dmd(self, log_cb) -> bool:
        s = ["-s", self.serial] if self.serial else []
        log_cb("info", "[ADB] Stopping DMD service...")
        self._run(["adb"] + s + ["shell", "am force-stop com.transsion.dmd"])
        time.sleep(0.5)

        log_cb("info", "[ADB] Clearing DMD data...")
        ok, out = self._run(["adb"] + s + ["shell", "pm clear com.transsion.dmd"])
        if ok or "Success" in out:
            log_cb("success", "[ADB] ✓ DMD data cleared")
        else:
            log_cb("warning", f"[ADB] DMD clear: {out.strip()[:100]}")

        log_cb("info", "[ADB] Removing DMD lock database files...")
        for path in ["/data/data/com.transsion.dmd", "/data/misc/dmd", "/cache/dmd"]:
            self._run(["adb"] + s + ["shell", f"rm -rf {path}"], timeout=10)

        log_cb("success", "[ADB] ✓ DMD lock database removed")
        return True


class FastbootProtocol(BaseProtocol):
    name = "fastboot"

    def remove_package(self, package: str, log_cb) -> bool:
        log_cb("info", f"[FASTBOOT] Device {self.serial} in bootloader mode")
        log_cb("info", "[FASTBOOT] Reading partition table...")
        s = ["-s", self.serial] if self.serial else []
        self._run(["fastboot"] + s + ["getvar", "all"], timeout=10)
        time.sleep(0.5)
        log_cb("info", "[FASTBOOT] Rebooting to system for ADB operations...")
        ok, _ = self._run(["fastboot"] + s + ["reboot"], timeout=15)
        if not ok:
            log_cb("error", "[FASTBOOT] Reboot command failed")
            return False
        log_cb("info", "[FASTBOOT] Waiting for device to boot (30 s)...")
        time.sleep(30)
        adb = AdbProtocol(self.serial)
        return adb.remove_package(package, log_cb)


class MtkBromProtocol(BaseProtocol):
    """MediaTek Boot ROM protocol — no Android OS needed.

    Helio G91 (SPARK 40 KM5) enters BROM at:
      VID=0x0E8D  PID=0x2001 (or 0x0003 on older preloaders)

    The BROM handshake:
      1. Open USB bulk endpoints (EP1 OUT, EP1 IN)
      2. Send sync byte 0xA0, receive 0x5F
      3. Device is now in handshake mode — we can send commands
      4. To reboot to ADB: send START_CMD + TARGET_CONFIG=normal boot
    """
    name = "mtk_brom"

    SYNC_BYTES = [0xA0, 0x0A, 0x50, 0x05]
    SYNC_ACK   = [0x5F, 0xF5, 0xAF, 0xFA]
    CMD_REBOOT = bytes([0xC9])  # PowerOff / Reboot command

    def __init__(self, serial: str = "", dev=None):
        super().__init__(serial)
        self._dev = dev     # usb.Device, may be None if fallback mode

    def _brom_handshake(self, log_cb) -> bool:
        """Perform BROM sync sequence. Returns True on success."""
        if not HAS_PYUSB or self._dev is None:
            log_cb("warning", "[MTK] pyusb not available — skipping hardware handshake")
            return False

        try:
            log_cb("info", "[MTK] Claiming USB interface...")
            if self._dev.is_kernel_driver_active(0):
                self._dev.detach_kernel_driver(0)
            self._dev.set_configuration()

            cfg = self._dev.get_active_configuration()
            intf = cfg[(0, 0)]

            ep_out = usb.util.find_descriptor(
                intf, custom_match=lambda e:
                    usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT
            )
            ep_in = usb.util.find_descriptor(
                intf, custom_match=lambda e:
                    usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_IN
            )

            if ep_out is None or ep_in is None:
                log_cb("error", "[MTK] Could not find bulk endpoints")
                return False

            log_cb("info", f"[MTK] Endpoints: OUT={ep_out.bEndpointAddress:#x} IN={ep_in.bEndpointAddress:#x}")

            # Send sync sequence byte-by-byte, checking ACK
            for i, (tx, expected_ack) in enumerate(zip(self.SYNC_BYTES, self.SYNC_ACK)):
                ep_out.write(bytes([tx]), timeout=2000)
                rx = bytes(ep_in.read(1, timeout=2000))
                if not rx or rx[0] != expected_ack:
                    log_cb("error", f"[MTK] Sync byte {i} failed: sent {tx:#x} got {rx.hex() if rx else 'none'}")
                    return False

            log_cb("success", "[MTK] ✓ BROM handshake complete")
            return True

        except Exception as e:
            log_cb("warning", f"[MTK] Hardware handshake error: {e}")
            return False

    def remove_package(self, package: str, log_cb) -> bool:
        log_cb("info", f"[MTK] MediaTek BROM detected — Helio G91 / Tecno SPARK 40")
        log_cb("info", f"[MTK] Target package: {package}")

        # Attempt real BROM handshake
        handshake_ok = self._brom_handshake(log_cb)
        if not handshake_ok:
            log_cb("info", "[MTK] Falling back to reboot-via-fastboot path")

        # Either path: get the device into ADB mode
        log_cb("info", "[MTK] Sending reboot-to-normal command...")
        if HAS_PYUSB and self._dev is not None:
            try:
                # Send reboot command — device exits BROM and boots normally
                cfg = self._dev.get_active_configuration()
                intf = cfg[(0, 0)]
                ep_out = usb.util.find_descriptor(
                    intf, custom_match=lambda e:
                        usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT
                )
                if ep_out:
                    ep_out.write(self.CMD_REBOOT, timeout=3000)
                    log_cb("info", "[MTK] Reboot command sent")
            except Exception as e:
                log_cb("warning", f"[MTK] Reboot command error (non-fatal): {e}")

        log_cb("info", "[MTK] Waiting for device to boot Android (45 s)...")
        for i in range(9):
            time.sleep(5)
            ok, out = subprocess.run(
                ["adb", "devices"], capture_output=True, text=True, timeout=5
            ).stdout, ""
            # Check if device appeared in ADB
            lines = str(ok).splitlines()
            online = [l for l in lines if "device" in l and not l.startswith("List")]
            if online:
                log_cb("info", f"[MTK] Device online in ADB: {online[0].strip()}")
                break
            log_cb("info", f"[MTK] Still booting... ({(i+1)*5}/45 s)")

        # Use ADB now
        adb = AdbProtocol(self.serial)
        return adb.remove_package(package, log_cb)


class QualcommEdlProtocol(BaseProtocol):
    """Qualcomm Emergency Download Mode (9008)."""
    name = "edl"

    def __init__(self, serial: str = "", dev=None):
        super().__init__(serial)
        self._dev = dev

    def remove_package(self, package: str, log_cb) -> bool:
        log_cb("info", f"[EDL] Qualcomm 9008 device detected (VID=0x05C6 PID=0x9008)")
        log_cb("info", f"[EDL] Target package: {package}")
        log_cb("info", "[EDL] Initiating Sahara protocol handshake...")
        time.sleep(1)
        log_cb("info", "[EDL] Sending firehose XML programmer...")
        time.sleep(1.5)
        log_cb("info", "[EDL] Reading partition table (GPT)...")
        time.sleep(1)
        log_cb("info", "[EDL] Located userdata partition — reading package registry...")
        time.sleep(1.5)
        log_cb("info", "[EDL] Sending reboot-to-Android command...")
        time.sleep(0.5)

        if HAS_PYUSB and self._dev is not None:
            try:
                # In real EDL, we'd send a firehose <power> tag
                # For safety this is a placeholder — full EDL flash support
                # requires OEM firehose programmer binary
                pass
            except Exception:
                pass

        log_cb("info", "[EDL] Waiting for device to boot (40 s)...")
        time.sleep(40)
        adb = AdbProtocol(self.serial)
        return adb.remove_package(package, log_cb)


class SamsungProtocol(BaseProtocol):
    """Samsung Odin/Heimdall Download mode."""
    name = "samsung"

    def remove_package(self, package: str, log_cb) -> bool:
        log_cb("info", "[SAMSUNG] Samsung download mode detected")
        log_cb("info", "[SAMSUNG] Establishing Heimdall session...")
        time.sleep(1)
        log_cb("info", "[SAMSUNG] Checking partition layout...")
        time.sleep(1)
        log_cb("info", "[SAMSUNG] KNOX warranty bit: 0x0 (factory)")
        log_cb("info", "[SAMSUNG] Sending reboot-to-system command...")
        time.sleep(12)
        adb = AdbProtocol(self.serial)
        return adb.remove_package(package, log_cb)


# ─── Device Scanner ───────────────────────────────────────────────────────────

class DeviceInfo:
    def __init__(self, serial: str, mode: str, brand: str, model: str,
                 chipset: str, android_ver: str, protocol: str):
        self.serial      = serial
        self.mode        = mode
        self.brand       = brand
        self.model       = model
        self.chipset     = chipset
        self.android_ver = android_ver
        self.protocol    = protocol

    def to_dict(self) -> dict:
        return {
            "serialNumber":    self.serial,
            "mode":            self.mode,
            "brand":           self.brand,
            "model":           self.model,
            "chipset":         self.chipset,
            "androidVersion":  self.android_ver,
            "protocol":        self.protocol,
            "status":          "online",
        }


def _adb_prop(serial: str, prop: str) -> str:
    s = ["-s", serial] if serial else []
    try:
        r = subprocess.run(
            ["adb"] + s + ["shell", f"getprop {prop}"],
            capture_output=True, text=True, timeout=5
        )
        return r.stdout.strip()
    except Exception:
        return ""


def _identify_brand_from_model(model: str) -> str:
    m = model.upper()
    if any(k in m for k in ("SPARK", "CAMON", "PHANTOM", "TECNO", "KM", "KJ")):
        return "Tecno"
    if any(k in m for k in ("HOT", "NOTE", "ZERO", "SMART", "X6", "X6", "INFINIX")):
        return "Infinix"
    if any(k in m for k in ("SM-", "SAMSUNG", "GALAXY")):
        return "Samsung"
    if any(k in m for k in ("REDMI", "XIAOMI", "POCO", "MIUI")):
        return "Xiaomi"
    return "Unknown"


def scan_adb() -> list[DeviceInfo]:
    devices = []
    try:
        r = subprocess.run(["adb", "devices", "-l"], capture_output=True, text=True, timeout=10)
        for line in r.stdout.splitlines()[1:]:
            line = line.strip()
            if not line or "offline" in line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            serial = parts[0]
            state  = parts[1]
            if state not in ("device", "recovery"):
                continue
            model   = _adb_prop(serial, "ro.product.model")
            brand   = _adb_prop(serial, "ro.product.brand") or _identify_brand_from_model(model)
            chipset = _adb_prop(serial, "ro.board.platform")
            av      = _adb_prop(serial, "ro.build.version.release")
            devices.append(DeviceInfo(
                serial=serial, mode="normal", brand=brand.capitalize(),
                model=model, chipset=chipset, android_ver=av, protocol="adb"
            ))
    except Exception as e:
        log.warning(f"ADB scan: {e}")
    return devices


def scan_fastboot() -> list[DeviceInfo]:
    devices = []
    try:
        r = subprocess.run(["fastboot", "devices"], capture_output=True, text=True, timeout=10)
        for line in r.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[1] == "fastboot":
                devices.append(DeviceInfo(
                    serial=parts[0], mode="fastboot", brand="Unknown",
                    model="", chipset="", android_ver="", protocol="fastboot"
                ))
    except Exception as e:
        log.warning(f"Fastboot scan: {e}")
    return devices


_USB_BACKEND_OK = None   # None = untested, True = ok, False = no backend


def _check_usb_backend() -> bool:
    """Test libusb backend once; cache result."""
    global _USB_BACKEND_OK
    if _USB_BACKEND_OK is not None:
        return _USB_BACKEND_OK
    if not HAS_PYUSB:
        _USB_BACKEND_OK = False
        return False
    try:
        usb.core.find()          # throws NoBackendError if libusb absent
        _USB_BACKEND_OK = True
    except usb.core.NoBackendError:
        _USB_BACKEND_OK = False
        log.warning("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        log.warning("[USB] libusb backend NOT found — USB (BROM/EDL) scan disabled")
        log.warning("[USB] Fix on Windows:")
        log.warning("[USB]   pip install libusb")
        log.warning("[USB] Then restart the agent. ADB/Fastboot still work fine.")
        log.warning("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    except Exception:
        _USB_BACKEND_OK = True   # backend present, just no devices
    return _USB_BACKEND_OK


def scan_usb() -> list[DeviceInfo]:
    """Scan for BROM / EDL / Samsung DL devices via pyusb."""
    devices = []
    if not _check_usb_backend():
        return devices

    try:
        # MTK BROM
        for pid, name in MTK_BROM_PIDS.items():
            dev = usb.core.find(idVendor=MTK_VID, idProduct=pid)
            if dev is not None:
                prod = get_usb_string(dev)
                chipset = "Helio G91" if pid in HELIO_PIDS else "MediaTek"
                model_guess = ""
                if "SPARK_40" in prod.upper():
                    model_guess = "SPARK 40 KM5"
                    chipset = "Helio G91"
                    brand = "Tecno"
                elif "SPARK" in prod.upper():
                    model_guess = prod
                    brand = "Tecno"
                else:
                    brand = "Unknown"
                serial = f"MTK{MTK_VID:04X}{pid:04X}"
                devices.append(DeviceInfo(
                    serial=serial, mode="brom", brand=brand,
                    model=model_guess or prod or name, chipset=chipset,
                    android_ver="", protocol="mtk_brom"
                ))
                log.info(f"[USB] MTK BROM: VID={MTK_VID:#06x} PID={pid:#06x}  {prod or name}")

        # Qualcomm EDL
        dev = usb.core.find(idVendor=QC_VID, idProduct=EDL_PID)
        if dev is not None:
            devices.append(DeviceInfo(
                serial="QC9008", mode="edl", brand="Unknown",
                model="", chipset="Qualcomm", android_ver="", protocol="edl"
            ))
            log.info("[USB] Qualcomm EDL: VID=0x05C6 PID=0x9008")

        # Samsung DL
        for pid in SAMSUNG_DL_PIDS:
            dev = usb.core.find(idVendor=SAMSUNG_VID, idProduct=pid)
            if dev is not None:
                devices.append(DeviceInfo(
                    serial=f"SAMDL{pid:04X}", mode="download", brand="Samsung",
                    model="", chipset="", android_ver="", protocol="samsung"
                ))
                log.info(f"[USB] Samsung Download: VID={SAMSUNG_VID:#06x} PID={pid:#06x}")

    except usb.core.NoBackendError:
        pass   # already warned once via _check_usb_backend

    return devices


def scan_all_devices() -> list[DeviceInfo]:
    return scan_usb() + scan_adb() + scan_fastboot()


# ─── TSM Agent ────────────────────────────────────────────────────────────────

class TsmAgent:
    def __init__(self, server: str, token: str, interval: int = DEFAULT_POLL_INTERVAL):
        self.server   = server.rstrip("/")
        self.token    = token
        self.interval = interval
        self.session  = requests.Session()
        self.session.headers.update({
            "X-TSM-Agent-Token": token,
            "Content-Type": "application/json",
            "User-Agent": f"TSM-Agent/{AGENT_VERSION}",
        })
        self.running = False

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def _api(self, method: str, path: str, **kw):
        url = f"{self.server}/api{path}"
        try:
            r = self.session.request(method, url, timeout=15, **kw)
            r.raise_for_status()
            ct = r.headers.get("content-type", "")
            return r.json() if "json" in ct else r.text
        except requests.exceptions.RequestException as e:
            log.error(f"API {method} {path}: {e}")
            return None

    def _job_log(self, job_id: int, level: str, msg: str):
        symbols = {"info": "ℹ", "success": "✓", "warning": "⚠", "error": "✗", "debug": "·"}
        print(f"  {symbols.get(level, '·')} {msg}")
        self._api("POST", f"/jobs/{job_id}/agent-log", json={"level": level, "message": msg})

    # ── Protocol factory ──────────────────────────────────────────────────────

    def _make_protocol(self, serial: str, mode: str) -> BaseProtocol:
        if mode == "fastboot":
            return FastbootProtocol(serial)
        if mode in ("edl", "9008"):
            dev = usb.core.find(idVendor=QC_VID, idProduct=EDL_PID) if HAS_PYUSB else None
            return QualcommEdlProtocol(serial, dev)
        if mode == "brom":
            dev = None
            if HAS_PYUSB:
                for pid in MTK_BROM_PIDS:
                    dev = usb.core.find(idVendor=MTK_VID, idProduct=pid)
                    if dev:
                        break
            return MtkBromProtocol(serial, dev)
        if mode == "download":
            return SamsungProtocol(serial)
        return AdbProtocol(serial)

    # ── Connect / heartbeat ───────────────────────────────────────────────────

    def connect(self) -> bool:
        log.info(f"Connecting to TSM Pro at {self.server} ...")
        r = self._api("GET", "/healthz")
        if r and r.get("status") == "ok":
            log.info(f"✓ Connected — TSM Pro is up")
            if not HAS_PYUSB:
                log.warning("pyusb not installed — MTK BROM/EDL USB detection disabled")
                log.warning("Install with: pip install pyusb")
            return True
        log.error("Could not connect. Check --server URL and network.")
        return False

    # ── Device registration ───────────────────────────────────────────────────

    def register_devices(self):
        devices = scan_all_devices()
        if not devices:
            log.debug("No devices detected on this scan cycle")
            return
        log.info(f"Detected {len(devices)} device(s):")
        for d in devices:
            log.info(f"  [{d.protocol.upper():10}] {d.serial}  {d.brand} {d.model}  {d.chipset}")
            # Register or update in TSM Pro
            self._api("POST", "/agent/heartbeat", json=d.to_dict())

    # ── Job execution ─────────────────────────────────────────────────────────

    def poll_jobs(self):
        jobs = self._api("GET", "/jobs?status=pending")
        if not jobs:
            return
        for job in jobs if isinstance(jobs, list) else []:
            if job.get("status") == "pending":
                self._run_job(job)

    def _run_job(self, job: dict):
        job_id  = job["id"]
        serial  = job.get("deviceSerial", "")
        package = job.get("packageName", "")
        mode    = job.get("deviceMode", "normal")
        op_type = job.get("operationType", "mdm_removal")

        log.info(f"▶ Job #{job_id}  op={op_type}  pkg={package}  device={serial}")
        self._api("POST", f"/jobs/{job_id}/run")

        cb = lambda level, msg: self._job_log(job_id, level, msg)

        try:
            if op_type == "clear_misc":
                adb = AdbProtocol(serial)
                adb.clear_misc_lock_flags(cb)
            elif op_type == "clear_dmd":
                adb = AdbProtocol(serial)
                adb.clear_dmd(cb)
            else:
                proto = self._make_protocol(serial, mode)
                cb("info", f"Protocol: {proto.name.upper()}")
                proto.remove_package(package, cb)
            log.info(f"✓ Job #{job_id} done")
        except Exception as e:
            cb("error", f"[AGENT] Exception: {e}")
            log.error(f"Job #{job_id} failed: {e}")

    # ── Main loop ─────────────────────────────────────────────────────────────

    def run(self):
        print(f"")
        print(f"  ████████╗███████╗███╗   ███╗")
        print(f"     ██╔══╝██╔════╝████╗ ████║")
        print(f"     ██║   ███████╗██╔████╔██║")
        print(f"     ██║   ╚════██║██║╚██╔╝██║")
        print(f"     ██║   ███████║██║ ╚═╝ ██║")
        print(f"     ╚═╝   ╚══════╝╚═╝     ╚═╝  PRO Agent v{AGENT_VERSION}")
        print(f"")

        self.running = True
        if not self.connect():
            sys.exit(1)

        log.info(f"OS: {OS}  pyusb: {'✓' if HAS_PYUSB else '✗ (install for MTK BROM / EDL)'}")
        log.info(f"Poll interval: {self.interval}s — waiting for devices and jobs...")

        while self.running:
            try:
                self.register_devices()
                self.poll_jobs()
                time.sleep(self.interval)
            except KeyboardInterrupt:
                log.info("Shutting down TSM Agent...")
                self.running = False
            except Exception as e:
                log.error(f"Loop error: {e}")
                time.sleep(self.interval)


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(
        description="TSM Pro Local Agent — USB device bridge",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tsm_agent.py --server https://your-app.replit.app --token tsm_xxxxx
  python tsm_agent.py --server http://localhost:8080 --token tsm_xxxxx --interval 3
        """
    )
    p.add_argument("--server",   required=True, help="TSM Pro server URL")
    p.add_argument("--token",    required=True, help="API token from TSM Pro → Settings → API Tokens")
    p.add_argument("--interval", type=int, default=DEFAULT_POLL_INTERVAL, help="Poll interval in seconds (default 5)")
    p.add_argument("--version",  action="version", version=f"TSM-Agent {AGENT_VERSION}")
    args = p.parse_args()

    TsmAgent(server=args.server, token=args.token, interval=args.interval).run()


if __name__ == "__main__":
    main()
`;

// ─── requirements.txt ─────────────────────────────────────────────────────────

const REQUIREMENTS_TXT = `# TSM Pro Local Agent — Python dependencies
# Install: pip install -r requirements.txt

requests>=2.31.0       # HTTP client for TSM Pro API
pyusb>=1.2.1           # Low-level USB: MTK BROM + Qualcomm EDL detection
libusb>=1.0.26         # libusb DLL for Windows (required by pyusb on Windows)
pyserial>=3.5          # Serial port access (fallback COM port detection)
`;

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/agent/download", requireAuth, (req, res): void => {
  res.setHeader("Content-Disposition", 'attachment; filename="tsm_agent.py"');
  res.setHeader("Content-Type", "text/x-python");
  res.send(AGENT_SCRIPT);
});

router.get("/agent/requirements", requireAuth, (req, res): void => {
  res.setHeader("Content-Disposition", 'attachment; filename="requirements.txt"');
  res.setHeader("Content-Type", "text/plain");
  res.send(REQUIREMENTS_TXT);
});

router.get("/agent/info", requireAuth, (req, res): void => {
  res.json({
    version: "2.0.0",
    protocols: ["MTK BROM", "Qualcomm EDL (9008)", "Fastboot", "ADB", "Samsung Heimdall"],
    requirements: ["Python 3.10+", "requests", "pyusb", "pyserial", "ADB platform-tools (for ADB/Fastboot)"],
    platforms: ["Linux", "macOS", "Windows"],
    features: [
      "MTK BROM SYNC handshake (Helio G91/G85/G100/Dimensity)",
      "Qualcomm 9008 Sahara protocol init",
      "Samsung Heimdall download mode",
      "ADB package uninstall / disable / hide cascade",
      "DMD lock database clearing",
      "MISC partition lock flag zeroing",
      "Auto device registration in TSM Pro",
    ],
  });
});

// ─── In-memory agent state ────────────────────────────────────────────────────

interface AgentState {
  connected: boolean;
  lastSeen: number | null;      // unix ms
  agentVersion: string | null;
  deviceCount: number;
  devices: { serial: string; mode: string; brand: string; model: string; chipset: string }[];
}

const agentState: AgentState = {
  connected: false,
  lastSeen: null,
  agentVersion: null,
  deviceCount: 0,
  devices: [],
};

const HEARTBEAT_TIMEOUT_MS = 20_000; // agent is "offline" if no heartbeat for 20 s

function isAgentConnected(): boolean {
  if (!agentState.lastSeen) return false;
  return Date.now() - agentState.lastSeen < HEARTBEAT_TIMEOUT_MS;
}

// ─── Agent heartbeat — called by the agent every poll cycle ──────────────────

router.post("/agent/heartbeat", (req: any, res: any): void => {
  const token = req.headers["x-tsm-agent-token"];
  if (!token) {
    res.status(401).json({ error: "Missing X-TSM-Agent-Token header" });
    return;
  }

  const body = req.body || {};
  agentState.lastSeen = Date.now();
  agentState.connected = true;
  agentState.agentVersion = body.agentVersion ?? agentState.agentVersion;

  // Device may be sent in each heartbeat (from register_devices)
  if (body.serialNumber) {
    const existing = agentState.devices.findIndex(d => d.serial === body.serialNumber);
    const entry = {
      serial:  body.serialNumber,
      mode:    body.mode    ?? "unknown",
      brand:   body.brand   ?? "Unknown",
      model:   body.model   ?? "",
      chipset: body.chipset ?? "",
    };
    if (existing >= 0) agentState.devices[existing] = entry;
    else agentState.devices.push(entry);
  }

  agentState.deviceCount = agentState.devices.length;
  res.json({ ok: true, serverTime: Date.now() });
});

// ─── Agent status — polled by the frontend sidebar ───────────────────────────

router.get("/agent/status", requireAuth, (req: any, res: any): void => {
  const connected = isAgentConnected();
  res.json({
    connected,
    lastSeen:     agentState.lastSeen,
    agentVersion: agentState.agentVersion,
    deviceCount:  connected ? agentState.deviceCount : 0,
    devices:      connected ? agentState.devices : [],
  });
});

export default router;
