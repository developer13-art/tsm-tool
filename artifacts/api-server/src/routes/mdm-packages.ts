import { Router } from "express";
import { db, mdmPackagesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

router.get("/mdm-packages", requireAuth, async (_req, res): Promise<void> => {
  const packages = await db.select().from(mdmPackagesTable);
  res.json(packages);
});

export default router;
