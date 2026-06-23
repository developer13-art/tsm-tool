import { pgTable, text, serial, timestamp, integer, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";
import { usersTable } from "./users";

export const opTypeEnum = pgEnum("op_type", [
  "security_removal",
  "dmd_read",
  "dmd_clear",
  "dmd_dump",
  "dmd_disable",
  "misc_read",
  "misc_write",
  "misc_clear_lock",
  "mdm_removal",
]);

export const opStatusEnum = pgEnum("op_status", ["pending", "running", "completed", "failed"]);
export const opLogLevelEnum = pgEnum("op_log_level", ["info", "success", "warning", "error", "debug"]);

export const deviceOpsTable = pgTable("device_operations", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  operationType: opTypeEnum("operation_type").notNull(),
  status: opStatusEnum("status").notNull().default("pending"),
  inputData: jsonb("input_data"),
  outputData: jsonb("output_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const opLogsTable = pgTable("operation_logs", {
  id: serial("id").primaryKey(),
  opId: integer("op_id").notNull().references(() => deviceOpsTable.id, { onDelete: "cascade" }),
  level: opLogLevelEnum("level").notNull().default("info"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeviceOpSchema = createInsertSchema(deviceOpsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeviceOp = z.infer<typeof insertDeviceOpSchema>;
export type DeviceOp = typeof deviceOpsTable.$inferSelect;
export type OpLog = typeof opLogsTable.$inferSelect;
