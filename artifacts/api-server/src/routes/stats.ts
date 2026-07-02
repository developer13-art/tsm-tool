import { Router } from "express";
import { db, devicesTable, jobsTable, usersTable, mdmPackagesTable, activityLogTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

router.get("/stats/dashboard", requireAuth, async (_req, res): Promise<void> => {
  const [devicesCount] = await db.select({ count: count() }).from(devicesTable);
  const [onlineCount] = await db.select({ count: count() }).from(devicesTable).where(eq(devicesTable.status, "online"));
  const [offlineCount] = await db.select({ count: count() }).from(devicesTable).where(eq(devicesTable.status, "offline"));
  const [jobsCount] = await db.select({ count: count() }).from(jobsTable);
  const [completedCount] = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "completed"));
  const [failedCount] = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "failed"));
  const [pendingCount] = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "pending"));
  const [runningCount] = await db.select({ count: count() }).from(jobsTable).where(eq(jobsTable.status, "running"));
  const [usersCount] = await db.select({ count: count() }).from(usersTable);
  const [pkgCount] = await db.select({ count: count() }).from(mdmPackagesTable);

  res.json({
    totalDevices: Number(devicesCount?.count ?? 0),
    onlineDevices: Number(onlineCount?.count ?? 0),
    offlineDevices: Number(offlineCount?.count ?? 0),
    totalJobs: Number(jobsCount?.count ?? 0),
    completedJobs: Number(completedCount?.count ?? 0),
    failedJobs: Number(failedCount?.count ?? 0),
    pendingJobs: Number(pendingCount?.count ?? 0),
    runningJobs: Number(runningCount?.count ?? 0),
    totalUsers: Number(usersCount?.count ?? 0),
    totalMdmPackages: Number(pkgCount?.count ?? 0),
  });
});

router.get("/stats/activity", requireAuth, async (_req, res): Promise<void> => {
  const activity = await db.select().from(activityLogTable)
    .orderBy(activityLogTable.createdAt)
    .limit(50);

  // Return in reverse chronological order
  res.json(activity.reverse());
});

export default router;
