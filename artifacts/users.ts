import { Router } from "express";
import { db, devicesTable, activityLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { KNOWN_DEVICES, generateImei } from "../lib/device-models";
import {
  CreateDeviceBody,
  UpdateDeviceBody,
  UpdateDeviceParams,
  GetDeviceParams,
  DeleteDeviceParams,
  RebootDeviceParams,
  RebootDeviceBody,
} from "@workspace/api-zod";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/devices", requireAuth, async (req, res): Promise<void> => {
  const devices = await db.select().from(devicesTable).orderBy(devicesTable.createdAt);
  res.json(devices);
});

router.post("/devices", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [device] = await db.insert(devicesTable).values({
    serialNumber: parsed.data.serialNumber,
    model: parsed.data.model,
    brand: parsed.data.brand,
    chipset: parsed.data.chipset,
    androidVersion: parsed.data.androidVersion ?? null,
    imei: parsed.data.imei ?? null,
    notes: parsed.data.notes ?? null,
    status: "offline",
    mode: "normal",
    bootloaderStatus: "unknown",
  }).returning();

  await db.insert(activityLogTable).values({
    type: "device_added",
    message: `Device ${device.brand} ${device.model} (${device.serialNumber}) registered`,
  });

  res.status(201).json(device);
});

router.post("/devices/scan", requireAuth, async (req, res): Promise<void> => {
  const ts = Date.now();

  // Pick 3 random known devices from the model database for demo purposes
  const picks = [
    KNOWN_DEVICES.find(d => d.model === "SPARK 40 KM5")!,
    KNOWN_DEVICES.find(d => d.brand === "Samsung" && d.model.includes("A55"))!,
    KNOWN_DEVICES.find(d => d.brand === "Xiaomi" && d.model.includes("Redmi Note 13"))!,
  ].filter(Boolean);

  const scanResults = picks.map((d, i) => ({
    serialNumber: `${d.brand.slice(0, 2).toUpperCase()}${ts}${String.fromCharCode(65 + i)}`,
    model: d.model,
    brand: d.brand,
    chipset: d.chipset,
    androidVersion: d.androidVersion,
    imei: generateImei(d.imeiPrefix),
    status: i === 0 ? ("online" as const) : i === 1 ? ("online" as const) : ("offline" as const),
    mode: "normal" as const,
    bootloaderStatus: d.bootloaderStatus,
  }));

  const inserted: typeof devicesTable.$inferSelect[] = [];
  for (const d of scanResults) {
    const existing = await db.select().from(devicesTable).where(eq(devicesTable.serialNumber, d.serialNumber));
    if (existing.length === 0) {
      const [device] = await db.insert(devicesTable).values(d).returning();
      inserted.push(device);
    }
  }

  await db.insert(activityLogTable).values({
    type: "scan_completed",
    message: `Device scan completed. Found ${inserted.length} new device(s).`,
  });

  const allDevices = await db.select().from(devicesTable).orderBy(devicesTable.createdAt);
  res.json(allDevices);
});

router.get("/devices/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetDeviceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, params.data.id));
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  res.json(device);
});

router.patch("/devices/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateDeviceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.model !== undefined) updateData.model = parsed.data.model;
  if (parsed.data.brand !== undefined) updateData.brand = parsed.data.brand;
  if (parsed.data.chipset !== undefined) updateData.chipset = parsed.data.chipset;
  if (parsed.data.androidVersion !== undefined) updateData.androidVersion = parsed.data.androidVersion;
  if (parsed.data.imei !== undefined) updateData.imei = parsed.data.imei;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.mode !== undefined) updateData.mode = parsed.data.mode;
  if (parsed.data.bootloaderStatus !== undefined) updateData.bootloaderStatus = parsed.data.bootloaderStatus;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

  const [device] = await db.update(devicesTable)
    .set(updateData as any)
    .where(eq(devicesTable.id, params.data.id))
    .returning();

  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  res.json(device);
});

router.delete("/devices/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDeviceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [device] = await db.delete(devicesTable).where(eq(devicesTable.id, params.data.id)).returning();
  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/devices/:id/reboot", requireAuth, async (req, res): Promise<void> => {
  const params = RebootDeviceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = RebootDeviceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [device] = await db.update(devicesTable)
    .set({ mode: body.data.mode })
    .where(eq(devicesTable.id, params.data.id))
    .returning();

  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  await db.insert(activityLogTable).values({
    type: "device_rebooted",
    message: `Device ${device.brand} ${device.model} rebooted to ${body.data.mode} mode`,
  });

  res.json(device);
});

export default router;
