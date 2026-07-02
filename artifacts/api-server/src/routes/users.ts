import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, activityLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateUserBody,
  UpdateUserParams,
  UpdateUserBody,
  DeleteUserParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../lib/auth-middleware";

const router = Router();

router.get("/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    email: usersTable.email,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);

  res.json(users);
});

router.post("/users", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, parsed.data.username));
  if (existing.length > 0) {
    res.status(400).json({ error: "Username already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [user] = await db.insert(usersTable).values({
    username: parsed.data.username,
    email: parsed.data.email,
    passwordHash,
    role: parsed.data.role,
  }).returning();

  await db.insert(activityLogTable).values({
    type: "user_created",
    message: `User "${user.username}" created with role ${user.role}`,
  });

  res.status(201).json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.patch("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.username !== undefined) updateData.username = parsed.data.username;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  if (parsed.data.password) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const [user] = await db.update(usersTable)
    .set(updateData as any)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  });
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db.delete(usersTable).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
