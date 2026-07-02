import { Router } from "express";
import { randomBytes } from "crypto";
import { db, apiTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth-middleware";

const router = Router();

// GET /tokens — list user's tokens
router.get("/tokens", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId as number;
  const tokens = await db.select({
    id: apiTokensTable.id,
    name: apiTokensTable.name,
    token: apiTokensTable.token,
    lastUsedAt: apiTokensTable.lastUsedAt,
    createdAt: apiTokensTable.createdAt,
  }).from(apiTokensTable)
    .where(eq(apiTokensTable.userId, userId))
    .orderBy(apiTokensTable.createdAt);

  // Mask token — show only last 8 chars
  const masked = tokens.map(t => ({
    ...t,
    tokenMasked: `tsm_${"•".repeat(24)}${t.token.slice(-8)}`,
    token: undefined,
  }));

  res.json(masked);
});

// POST /tokens — generate a new token
router.post("/tokens", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId as number;
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Token name is required" });
    return;
  }

  const rawToken = `tsm_${randomBytes(32).toString("hex")}`;
  const [token] = await db.insert(apiTokensTable).values({
    userId,
    name: name.trim(),
    token: rawToken,
  }).returning();

  // Return the full token only on creation
  res.status(201).json({ ...token, tokenFull: rawToken });
});

// DELETE /tokens/:id — revoke a token
router.delete("/tokens/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session!.userId as number;
  const id = parseInt(req.params.id);

  const [deleted] = await db.delete(apiTokensTable)
    .where(and(eq(apiTokensTable.id, id), eq(apiTokensTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Token not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
