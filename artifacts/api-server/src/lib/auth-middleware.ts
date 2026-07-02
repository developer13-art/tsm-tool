import { RequestHandler } from "express";
import { db, apiTokensTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const requireAuth: RequestHandler = async (req, res, next) => {
  if (req.session?.userId) {
    return next();
  }

  // Accept Authorization: Bearer <token>  OR  X-TSM-Agent-Token: <token>
  const authHeader = req.headers.authorization;
  const agentTokenHeader = req.headers["x-tsm-agent-token"];
  const rawToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : typeof agentTokenHeader === "string"
    ? agentTokenHeader.trim()
    : null;

  if (rawToken) {
    try {
      const [tokenRow] = await db
        .select({ id: apiTokensTable.id, userId: apiTokensTable.userId })
        .from(apiTokensTable)
        .where(eq(apiTokensTable.token, rawToken));

      if (tokenRow) {
        const [user] = await db
          .select({ role: usersTable.role })
          .from(usersTable)
          .where(eq(usersTable.id, tokenRow.userId));

        req.session.userId = tokenRow.userId;
        req.session.role = user?.role ?? "technician";

        db.update(apiTokensTable)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiTokensTable.id, tokenRow.id))
          .catch(() => {});

        return next();
      }
    } catch {
    }
  }

  res.status(401).json({ error: "Not authenticated" });
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};
