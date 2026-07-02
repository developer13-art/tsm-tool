import { Router } from "express";
import { db, jobsTable, jobLogsTable, devicesTable, mdmPackagesTable, activityLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateJobBody,
  GetJobParams,
  GetJobLogsParams,
  RunJobParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

async function getJobWithNames(jobId: number) {
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) return null;

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, job.deviceId));
  const [pkg] = await db.select().from(mdmPackagesTable).where(eq(mdmPackagesTable.id, job.packageId));

  return {
    ...job,
    deviceName: device ? `${device.brand} ${device.model}` : null,
    packageName: pkg ? pkg.displayName : null,
  };
}

const VALID_STATUSES = ["pending", "running", "completed", "failed"] as const;
type JobStatus = typeof VALID_STATUSES[number];

router.get("/jobs", requireAuth, async (req, res): Promise<void> => {
  const { status } = req.query;

  let jobs;
  if (typeof status === "string" && VALID_STATUSES.includes(status as JobStatus)) {
    jobs = await db.select().from(jobsTable)
      .where(eq(jobsTable.status, status as JobStatus))
      .orderBy(jobsTable.createdAt);
  } else {
    jobs = await db.select().from(jobsTable).orderBy(jobsTable.createdAt);
  }

  const jobsWithNames = await Promise.all(
    jobs.map(async (job) => {
      const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, job.deviceId));
      const [pkg] = await db.select().from(mdmPackagesTable).where(eq(mdmPackagesTable.id, job.packageId));
      return {
        ...job,
        deviceName: device ? `${device.brand} ${device.model}` : null,
        packageName: pkg ? pkg.displayName : null,
      };
    })
  );

  res.json(jobsWithNames);
});

router.post("/jobs", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, parsed.data.deviceId));
  if (!device) {
    res.status(400).json({ error: "Device not found" });
    return;
  }

  const [pkg] = await db.select().from(mdmPackagesTable).where(eq(mdmPackagesTable.id, parsed.data.packageId));
  if (!pkg) {
    res.status(400).json({ error: "MDM package not found" });
    return;
  }

  const [job] = await db.insert(jobsTable).values({
    deviceId: parsed.data.deviceId,
    packageId: parsed.data.packageId,
    notes: parsed.data.notes ?? null,
    status: "pending",
    progress: 0,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "job_created",
    message: `MDM removal job created for ${device.brand} ${device.model} — ${pkg.displayName}`,
  });

  const jobWithNames = {
    ...job,
    deviceName: `${device.brand} ${device.model}`,
    packageName: pkg.displayName,
  };

  res.status(201).json(jobWithNames);
});

router.get("/jobs/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const job = await getJobWithNames(params.data.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const logs = await db.select().from(jobLogsTable)
    .where(eq(jobLogsTable.jobId, params.data.id))
    .orderBy(jobLogsTable.createdAt);

  res.json({ ...job, logs });
});

router.get("/jobs/:id/logs", requireAuth, async (req, res): Promise<void> => {
  const params = GetJobLogsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const logs = await db.select().from(jobLogsTable)
    .where(eq(jobLogsTable.jobId, params.data.id))
    .orderBy(jobLogsTable.createdAt);

  res.json(logs);
});

router.post("/jobs/:id/run", requireAuth, async (req, res): Promise<void> => {
  const params = RunJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const job = await getJobWithNames(params.data.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "pending") {
    res.status(400).json({ error: "Job is not in pending state" });
    return;
  }

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, job.deviceId));
  const [pkg] = await db.select().from(mdmPackagesTable).where(eq(mdmPackagesTable.id, job.packageId));

  // Update job to running
  await db.update(jobsTable)
    .set({ status: "running", startedAt: new Date(), progress: 0 })
    .where(eq(jobsTable.id, job.id));

  // Simulate MDM removal process asynchronously
  simulateMdmRemoval(job.id, device?.brand ?? "Unknown", device?.model ?? "Device", pkg?.displayName ?? "Package", pkg?.chipsets ?? []).catch(() => {});

  const updatedJob = await getJobWithNames(job.id);
  res.json(updatedJob);
});

async function simulateMdmRemoval(jobId: number, brand: string, model: string, pkgName: string, chipsets: string[]) {
  const addLog = async (level: "info" | "success" | "warning" | "error" | "debug", message: string) => {
    await db.insert(jobLogsTable).values({ jobId, level, message });
  };

  const updateProgress = async (progress: number) => {
    await db.update(jobsTable).set({ progress }).where(eq(jobsTable.id, jobId));
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    await addLog("info", `[TSM] Initializing MDM removal for ${brand} ${model}`);
    await delay(800);
    await updateProgress(5);

    const chipset = chipsets[0] ?? "Qualcomm";
    await addLog("info", `[DETECT] Chipset identified: ${chipset}`);
    await delay(600);
    await addLog("debug", `[DETECT] Loading protocol handler for ${chipset}`);
    await delay(400);
    await updateProgress(15);

    await addLog("info", `[PROTO] Establishing device connection...`);
    await delay(1000);
    await addLog("success", `[PROTO] Device connection established`);
    await updateProgress(25);

    await addLog("info", `[SCAN] Scanning installed packages...`);
    await delay(800);
    await addLog("debug", `[SCAN] Found ${Math.floor(Math.random() * 50) + 80} installed packages`);
    await updateProgress(35);

    await addLog("info", `[MDM] Locating ${pkgName}...`);
    await delay(600);
    await addLog("success", `[MDM] Package ${pkgName} found — version ${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 100)}`);
    await updateProgress(45);

    await addLog("info", `[MDM] Disabling admin privileges...`);
    await delay(1200);
    await addLog("success", `[MDM] Device admin privileges revoked`);
    await updateProgress(60);

    await addLog("info", `[MDM] Removing package data...`);
    await delay(1000);
    await addLog("debug", `[MDM] Clearing cache: 47.3 MB freed`);
    await delay(500);
    await updateProgress(75);

    await addLog("info", `[MDM] Uninstalling ${pkgName}...`);
    await delay(1500);
    await addLog("success", `[MDM] Package uninstalled successfully`);
    await updateProgress(90);

    await addLog("info", `[VERIFY] Running post-removal verification...`);
    await delay(800);
    await addLog("success", `[VERIFY] Verification passed — MDM package not found`);
    await updateProgress(98);

    await addLog("success", `[TSM] MDM removal completed successfully for ${brand} ${model}`);
    await delay(300);
    await updateProgress(100);

    await db.update(jobsTable)
      .set({ status: "completed", completedAt: new Date(), progress: 100 })
      .where(eq(jobsTable.id, jobId));

    await db.insert(activityLogTable).values({
      type: "job_completed",
      message: `MDM removal completed for ${brand} ${model} — ${pkgName}`,
    });

  } catch (err) {
    await addLog("error", `[TSM] Fatal error during MDM removal: ${String(err)}`);
    await db.update(jobsTable)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    await db.insert(activityLogTable).values({
      type: "job_failed",
      message: `MDM removal failed for ${brand} ${model} — ${pkgName}`,
    });
  }
}

export default router;
