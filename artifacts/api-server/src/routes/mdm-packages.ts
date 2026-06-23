import { Router } from "express";
import { db, mdmPackagesTable } from "@workspace/db";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/mdm-packages", requireAuth, async (_req, res): Promise<void> => {
  const packages = await db.select().from(mdmPackagesTable);
  res.json(packages);
});

export default router;
