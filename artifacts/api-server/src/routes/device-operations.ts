import { Router } from "express";
import { db, devicesTable, deviceOpsTable, opLogsTable, activityLogTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

async function addLog(opId: number, level: "info" | "success" | "warning" | "error" | "debug", message: string) {
  await db.insert(opLogsTable).values({ opId, level, message });
}

// Brand-specific security plugins
const SECURITY_PLUGINS: Record<string, Array<{ packageName: string; displayName: string; description: string; severity: "critical" | "high" | "medium" }>> = {
  tecno: [
    { packageName: "com.transsion.carlockservice", displayName: "Carrier Lock Service", description: "Primary carrier/financing lock enforcement daemon", severity: "critical" },
    { packageName: "com.transsion.dmd", displayName: "DMD Service", description: "Transsion Device Management Daemon — controls lock state", severity: "critical" },
    { packageName: "com.tecno.sealapp", displayName: "Tecno Seal App", description: "Financing lock enforcement for device payment programs", severity: "critical" },
    { packageName: "com.transsion.devicemanager", displayName: "Device Manager", description: "Remote device management and policy enforcement", severity: "high" },
    { packageName: "com.transsion.security", displayName: "Security Center", description: "Transsion Security Center — may enforce MDM policies", severity: "high" },
    { packageName: "com.transsion.phonemaster", displayName: "Phone Master", description: "System cleaner with MDM policy integration", severity: "medium" },
    { packageName: "com.tecno.mstore", displayName: "MStore", description: "Carrier-locked app store with device binding", severity: "medium" },
    { packageName: "com.transsion.aibutler", displayName: "AI Butler", description: "OEM assistant with device management hooks", severity: "medium" },
  ],
  infinix: [
    { packageName: "com.transsion.carlockservice", displayName: "Carrier Lock Service", description: "Primary carrier lock enforcement", severity: "critical" },
    { packageName: "com.transsion.dmd", displayName: "DMD Service", description: "Infinix Device Management Daemon", severity: "critical" },
    { packageName: "com.transsion.devicemanager", displayName: "Device Manager", description: "Remote device management", severity: "high" },
    { packageName: "com.transsion.security", displayName: "Security Center", description: "OEM security and MDM policy center", severity: "high" },
    { packageName: "com.itel.xhome", displayName: "XHome Launcher Lock", description: "Launcher with integrated device lock hooks", severity: "medium" },
  ],
  samsung: [
    { packageName: "com.samsung.android.knox.enrollment", displayName: "Knox Enrollment", description: "Samsung Knox MDM enrollment service", severity: "critical" },
    { packageName: "com.sec.enterprise.knox.cloudmdm.samsungknox", displayName: "Knox Cloud MDM", description: "Samsung Knox cloud-based device management", severity: "critical" },
    { packageName: "com.samsung.android.mdm", displayName: "Samsung MDM Agent", description: "Samsung enterprise MDM agent", severity: "critical" },
    { packageName: "com.samsung.android.knox.attestation", displayName: "Knox Attestation", description: "Knox hardware attestation service", severity: "high" },
    { packageName: "com.samsung.android.kgclient", displayName: "Knox Guard Client", description: "Samsung Knox Guard — financing lock", severity: "critical" },
    { packageName: "com.samsung.android.spay", displayName: "Samsung Pay Lock", description: "Samsung Pay with carrier MDM integration", severity: "medium" },
  ],
  xiaomi: [
    { packageName: "com.xiaomi.mtbservice", displayName: "MTB Service", description: "Xiaomi Mobile Track & Block service", severity: "critical" },
    { packageName: "com.miui.cloudservice", displayName: "MIUI Cloud Lock", description: "MIUI cloud-based lock enforcement", severity: "high" },
    { packageName: "com.xiaomi.finddevice", displayName: "Find Device", description: "Xiaomi Find Device with remote lock", severity: "high" },
    { packageName: "com.miui.securitycenter", displayName: "Security Center", description: "MIUI Security Center MDM component", severity: "medium" },
  ],
  generic: [
    { packageName: "com.android.settings.devicelock", displayName: "Android DeviceLock", description: "Google DeviceLock for carrier financing programs", severity: "critical" },
    { packageName: "com.microsoft.intune", displayName: "Microsoft Intune", description: "Microsoft enterprise MDM", severity: "critical" },
    { packageName: "com.vmware.android.horizon", displayName: "VMware Horizon", description: "VMware enterprise MDM client", severity: "high" },
    { packageName: "com.mobileiron.android", displayName: "Ivanti MobileIron", description: "MobileIron enterprise MDM", severity: "high" },
    { packageName: "com.meraki.sm", displayName: "Meraki SM", description: "Cisco Meraki Systems Manager MDM", severity: "high" },
  ],
};

// Simulated MISC partition templates
function generateMiscHex(deviceBrand: string): string {
  const lines: string[] = [];
  // BCB header
  lines.push("=== MISC PARTITION DUMP ===");
  lines.push("Offset    Hex                                              ASCII");
  lines.push("─────────────────────────────────────────────────────────────────");
  lines.push("00000000: 626F 6F74 2D72 6563 6F76 6572 7900 0000  boot-recovery...");
  lines.push("00000010: 0000 0000 0000 0000 0000 0000 0000 0000  ................");
  lines.push("00000020: 0000 0000 0000 0000 0000 0000 0000 0000  ................");
  lines.push("00000030: 0000 0000 0000 0000 0000 0000 0000 0000  ................");
  lines.push("00000080: 5573 6572 4461 7461 5061 7274 6974 696F  UserDataPartitio");
  lines.push("00000090: 6E00 0000 0000 0000 0000 0000 0000 0000  n...............");
  lines.push("...");
  lines.push("00000200: 4C4F 434B 5354 4154 5553 3D01 0000 0000  LOCKSTATUS=.....");
  if (deviceBrand.toLowerCase() === "tecno" || deviceBrand.toLowerCase() === "infinix") {
    lines.push("00000210: 5452 414E 5353 494F 4E44 4D44 0100 0000  TRANSSIONDMD....");
    lines.push("00000220: 4341 5252 4945 524C 4F43 4B3D 0100 0000  CARRIERLOCK=....");
    lines.push("00000230: 5345 414C 5354 4154 5553 3D01 0000 0000  SEALSTATUS=.....");
  } else if (deviceBrand.toLowerCase() === "samsung") {
    lines.push("00000210: 4B4E 4F58 5354 4154 5553 3D01 0000 0000  KNOXSTATUS=.....");
    lines.push("00000220: 4B4E 4F58 5741 5252 414E 5459 3D01 0000  KNOXWARRANTY=...");
  } else {
    lines.push("00000210: 4156 425F4C 4F43 4B3D 0100 0000 0000 00  AVB_LOCK=.......");
  }
  lines.push("00000400: 0000 0000 0000 0000 0000 0000 0000 0000  ................");
  lines.push("00000410: 0000 0000 0000 0000 0000 0000 0000 0000  ................");
  lines.push("─────────────────────────────────────────────────────────────────");
  lines.push(`Total: 524288 bytes (512 KB) read`);
  return lines.join("\n");
}

async function simulateOperation(opId: number, operationType: string, device: typeof devicesTable.$inferSelect, inputData: any) {
  const brand = device.brand.toLowerCase();

  await db.update(deviceOpsTable).set({ status: "running" }).where(eq(deviceOpsTable.id, opId));

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  try {
    if (operationType === "security_removal") {
      const pkg = inputData?.packageName as string;
      const pkgDisplay = inputData?.displayName as string;
      await addLog(opId, "info", `[INIT] Security plugin removal started`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] Connecting to ${device.brand} ${device.model} (${device.serialNumber})`);
      await sleep(600);
      await addLog(opId, "info", `[ADB] Target package: ${pkg}`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] Checking package presence...`);
      await sleep(600);
      await addLog(opId, "info", `[ADB] Package found: ${pkg}`);
      await sleep(300);
      await addLog(opId, "info", `[ADB] Revoking device admin privileges...`);
      await sleep(700);
      await addLog(opId, "info", `[ADB] $ dpm remove-active-admin ${pkg}/.AdminReceiver`);
      await sleep(500);
      await addLog(opId, "info", `[ADB] Disabling package...`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] $ pm disable-user --user 0 ${pkg}`);
      await sleep(600);
      await addLog(opId, "info", `[ADB] Clearing package data...`);
      await sleep(500);
      await addLog(opId, "info", `[ADB] $ pm clear --user 0 ${pkg}`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] Uninstalling for all users...`);
      await sleep(700);
      await addLog(opId, "info", `[ADB] $ pm uninstall --user 0 ${pkg}`);
      await sleep(500);
      await addLog(opId, "success", `[ADB] Package ${pkgDisplay} removed successfully`);
      await addLog(opId, "info", `[DONE] Security plugin removal complete`);
      await db.update(deviceOpsTable).set({ status: "completed", outputData: { removed: pkg } }).where(eq(deviceOpsTable.id, opId));

    } else if (operationType === "dmd_read") {
      await addLog(opId, "info", `[DMD] Reading Device Management Daemon state...`);
      await sleep(500);
      await addLog(opId, "info", `[ADB] $ adb shell dumpsys activity service com.transsion.dmd`);
      await sleep(800);
      await addLog(opId, "info", `[DMD] Service running: com.transsion.dmd/.DmdService`);
      await sleep(400);
      await addLog(opId, "info", `[DMD] Lock state: ACTIVE`);
      await sleep(300);
      await addLog(opId, "warning", `[DMD] Carrier lock detected: ENABLED`);
      await sleep(400);
      await addLog(opId, "warning", `[DMD] Financing lock detected: ENABLED`);
      await sleep(300);
      await addLog(opId, "info", `[DMD] DMD database path: /data/data/com.transsion.dmd/databases/dmd.db`);
      await sleep(400);
      await addLog(opId, "info", `[DMD] Lock entries: 3`);
      await sleep(300);
      await addLog(opId, "info", `[DMD] Entry 0: CARRIER_LOCK (sim_mcc=62150, active=1)`);
      await sleep(300);
      await addLog(opId, "info", `[DMD] Entry 1: FINANCE_LOCK (provider=mstore, active=1)`);
      await sleep(300);
      await addLog(opId, "info", `[DMD] Entry 2: FACTORY_RESET_PROTECTION (active=1)`);
      await sleep(400);
      await addLog(opId, "info", `[DMD] Read complete`);
      const output = { lockState: "ACTIVE", carrierLock: true, financeLock: true, frp: true, entries: 3 };
      await db.update(deviceOpsTable).set({ status: "completed", outputData: output }).where(eq(deviceOpsTable.id, opId));

    } else if (operationType === "dmd_clear") {
      await addLog(opId, "info", `[DMD] Starting DMD lock clear procedure...`);
      await sleep(500);
      await addLog(opId, "info", `[ADB] Forcing DMD service stop...`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] $ am force-stop com.transsion.dmd`);
      await sleep(600);
      await addLog(opId, "info", `[ADB] Pulling DMD database...`);
      await sleep(500);
      await addLog(opId, "info", `[ADB] $ adb pull /data/data/com.transsion.dmd/databases/dmd.db /tmp/dmd_backup.db`);
      await sleep(800);
      await addLog(opId, "success", `[ADB] Database backed up: dmd_backup.db`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] Clearing lock entries from database...`);
      await sleep(600);
      await addLog(opId, "info", `[ADB] $ adb shell "sqlite3 /data/data/com.transsion.dmd/databases/dmd.db 'DELETE FROM lock_entries;'"`);
      await sleep(700);
      await addLog(opId, "success", `[ADB] 3 lock entries removed`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] Clearing package data...`);
      await sleep(500);
      await addLog(opId, "info", `[ADB] $ pm clear --user 0 com.transsion.dmd`);
      await sleep(600);
      await addLog(opId, "success", `[ADB] DMD data cleared`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] Rebooting device...`);
      await sleep(300);
      await addLog(opId, "success", `[DONE] DMD lock cleared successfully. Device will reboot.`);
      await db.update(deviceOpsTable).set({ status: "completed", outputData: { cleared: true, entriesRemoved: 3 } }).where(eq(deviceOpsTable.id, opId));

    } else if (operationType === "dmd_dump") {
      await addLog(opId, "info", `[DMD] Starting full DMD database dump...`);
      await sleep(500);
      await addLog(opId, "info", `[ADB] $ adb pull /data/data/com.transsion.dmd/databases/ /tmp/dmd_dump/`);
      await sleep(1000);
      await addLog(opId, "success", `[ADB] 3 files pulled`);
      await sleep(300);
      await addLog(opId, "info", `[DUMP] dmd.db — 24576 bytes`);
      await addLog(opId, "info", `[DUMP] dmd.db-shm — 32768 bytes`);
      await addLog(opId, "info", `[DUMP] dmd.db-wal — 8192 bytes`);
      await sleep(400);
      await addLog(opId, "info", `[SQL] Tables: lock_entries, device_config, sync_log, server_keys`);
      await sleep(400);
      await addLog(opId, "info", `[SQL] lock_entries: 3 rows`);
      await addLog(opId, "info", `  row 0: id=1, type='CARRIER', mcc='62150', active=1, ts=1719000000`);
      await addLog(opId, "info", `  row 1: id=2, type='FINANCE', provider='mstore', active=1, ts=1719000100`);
      await addLog(opId, "info", `  row 2: id=3, type='FRP', active=1, ts=1719000200`);
      await sleep(400);
      await addLog(opId, "info", `[SQL] server_keys: 1 row`);
      await addLog(opId, "info", `  row 0: key_id='TRANSSION_MDM_2024', pubkey='RSA4096...'`);
      await sleep(400);
      await addLog(opId, "success", `[DONE] DMD database dump complete`);
      await db.update(deviceOpsTable).set({ status: "completed", outputData: { dumped: true, tables: 4, lockEntries: 3 } }).where(eq(deviceOpsTable.id, opId));

    } else if (operationType === "dmd_disable") {
      await addLog(opId, "info", `[DMD] Disabling DMD service permanently...`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] $ am force-stop com.transsion.dmd`);
      await sleep(500);
      await addLog(opId, "info", `[ADB] $ pm disable-user --user 0 com.transsion.dmd`);
      await sleep(600);
      await addLog(opId, "success", `[ADB] DMD service disabled`);
      await sleep(300);
      await addLog(opId, "info", `[ADB] Disabling carrier lock service...`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] $ pm disable-user --user 0 com.transsion.carlockservice`);
      await sleep(600);
      await addLog(opId, "success", `[ADB] Carrier lock service disabled`);
      await sleep(300);
      await addLog(opId, "info", `[ADB] Writing disable flags to MISC partition...`);
      await sleep(800);
      await addLog(opId, "success", `[DONE] DMD fully disabled. Device management lock removed.`);
      await db.update(deviceOpsTable).set({ status: "completed", outputData: { disabled: true } }).where(eq(deviceOpsTable.id, opId));

    } else if (operationType === "misc_read") {
      await addLog(opId, "info", `[MISC] Reading MISC partition...`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] $ adb shell "dd if=/dev/block/by-name/misc bs=512 count=1024 2>/dev/null | xxd"`);
      await sleep(1200);
      await addLog(opId, "info", `[MISC] Reading BCB (Bootloader Control Block)...`);
      await sleep(400);
      const hexDump = generateMiscHex(device.brand);
      await addLog(opId, "info", hexDump);
      await sleep(500);
      await addLog(opId, "info", `[BCB] Command field: "boot-recovery"`);
      await addLog(opId, "info", `[BCB] Status field: empty`);
      await addLog(opId, "warning", `[MISC] Lock flags detected at offset 0x200`);
      if (brand === "tecno" || brand === "infinix") {
        await addLog(opId, "warning", `[MISC] CARRIERLOCK=1 detected at offset 0x220`);
        await addLog(opId, "warning", `[MISC] SEALSTATUS=1 detected at offset 0x230`);
      }
      await addLog(opId, "success", `[DONE] MISC partition read complete`);
      await db.update(deviceOpsTable).set({ status: "completed", outputData: { hexDump, size: 524288 } }).where(eq(deviceOpsTable.id, opId));

    } else if (operationType === "misc_write") {
      const command = inputData?.command || "recovery";
      const payload = inputData?.payload || "";
      await addLog(opId, "info", `[MISC] Writing to MISC partition...`);
      await sleep(400);
      await addLog(opId, "info", `[BCB] Constructing BCB header...`);
      await sleep(300);
      await addLog(opId, "info", `[BCB] command = "${command}"`);
      if (payload) await addLog(opId, "info", `[BCB] recovery = "${payload}"`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] $ adb shell "dd of=/dev/block/by-name/misc bs=512 count=1"`);
      await sleep(800);
      await addLog(opId, "success", `[MISC] BCB written successfully`);
      await sleep(300);
      await addLog(opId, "info", `[MISC] Verifying write...`);
      await sleep(600);
      await addLog(opId, "success", `[DONE] MISC write verified. Reboot to apply.`);
      await db.update(deviceOpsTable).set({ status: "completed", outputData: { written: true, command, payload } }).where(eq(deviceOpsTable.id, opId));

    } else if (operationType === "misc_clear_lock") {
      await addLog(opId, "info", `[MISC] Clearing lock flags from MISC partition...`);
      await sleep(400);
      await addLog(opId, "info", `[ADB] Reading current MISC partition...`);
      await sleep(600);
      await addLog(opId, "warning", `[MISC] Lock flags found at offset 0x200`);
      if (brand === "tecno" || brand === "infinix") {
        await addLog(opId, "warning", `[MISC] Detected: CARRIERLOCK=1, SEALSTATUS=1, TRANSSIONDMD=1`);
      } else {
        await addLog(opId, "warning", `[MISC] Detected: AVB_LOCK=1, LOCKSTATUS=1`);
      }
      await sleep(500);
      await addLog(opId, "info", `[MISC] Zeroing lock region (offset 0x200, 512 bytes)...`);
      await sleep(700);
      await addLog(opId, "info", `[ADB] $ adb shell "dd if=/dev/zero of=/dev/block/by-name/misc bs=1 seek=512 count=512"`);
      await sleep(900);
      await addLog(opId, "success", `[MISC] Lock flags cleared`);
      await sleep(400);
      await addLog(opId, "info", `[MISC] Verifying clear...`);
      await sleep(500);
      await addLog(opId, "success", `[DONE] MISC lock flags cleared. Reboot required.`);
      await db.update(deviceOpsTable).set({ status: "completed", outputData: { cleared: true } }).where(eq(deviceOpsTable.id, opId));
    }
  } catch (err) {
    logger.error({ err, opId }, "Operation simulation failed");
    await addLog(opId, "error", `[ERROR] Operation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    await db.update(deviceOpsTable).set({ status: "failed" }).where(eq(deviceOpsTable.id, opId));
  }
}

// GET /devices/:id/plugins — get brand-specific plugin list
router.get("/devices/:id/plugins", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
  if (!device) { res.status(404).json({ error: "Device not found" }); return; }

  const brand = device.brand.toLowerCase();
  const plugins = SECURITY_PLUGINS[brand] ?? SECURITY_PLUGINS["generic"];
  // Always add generic ones if brand-specific exists
  const allPlugins = brand !== "generic"
    ? [...(SECURITY_PLUGINS[brand] ?? []), ...SECURITY_PLUGINS["generic"]]
    : SECURITY_PLUGINS["generic"];

  res.json({ brand: device.brand, model: device.model, plugins: allPlugins });
});

// GET /devices/:id/operations — list operations for a device
router.get("/devices/:id/operations", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const ops = await db.select().from(deviceOpsTable)
    .where(eq(deviceOpsTable.deviceId, id))
    .orderBy(deviceOpsTable.createdAt);
  res.json(ops);
});

// POST /devices/:id/operations — create and run an operation
router.post("/devices/:id/operations", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
  if (!device) { res.status(404).json({ error: "Device not found" }); return; }

  const { operationType, inputData } = req.body;
  if (!operationType) { res.status(400).json({ error: "operationType required" }); return; }

  const [op] = await db.insert(deviceOpsTable).values({
    deviceId: id,
    userId: req.session?.userId ?? null,
    operationType,
    status: "pending",
    inputData: inputData ?? null,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "operation_started",
    message: `${operationType} started on ${device.brand} ${device.model}`,
  });

  res.status(201).json(op);

  // Run simulation asynchronously
  simulateOperation(op.id, operationType, device, inputData).catch(err =>
    logger.error({ err, opId: op.id }, "Background op simulation error")
  );
});

// GET /devices/:id/operations/:opId/logs
router.get("/devices/:id/operations/:opId/logs", requireAuth, async (req, res): Promise<void> => {
  const opId = parseInt(req.params.opId);
  const [op] = await db.select().from(deviceOpsTable).where(eq(deviceOpsTable.id, opId));
  if (!op) { res.status(404).json({ error: "Operation not found" }); return; }

  const logs = await db.select().from(opLogsTable)
    .where(eq(opLogsTable.opId, opId))
    .orderBy(opLogsTable.createdAt);

  res.json({ op, logs });
});

export default router;
