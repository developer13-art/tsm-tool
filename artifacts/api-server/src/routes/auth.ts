import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  LoginBody,
  RegisterBody,
} from "@workspace/api-zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

const router = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  req.session.userId = user.id;
  req.session.role = user.role;

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to save session" });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, email } = parsed.data;

  // Check if any users exist — first user is admin
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) {
    res.status(400).json({ error: "Username already exists" });
    return;
  }

  const existingEmail = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existingEmail.length > 0) {
    res.status(400).json({ error: "Email already exists" });
    return;
  }

  const allUsers = await db.select().from(usersTable);
  const role = allUsers.length === 0 ? "admin" : "technician";

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    username,
    email,
    passwordHash,
    role: role as "admin" | "technician",
  }).returning();

  req.session.userId = user.id;
  req.session.role = user.role;

  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to save session" });
      return;
    }
    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  });
});

export default router;
