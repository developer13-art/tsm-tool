import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";
import { mdmPackagesTable } from "./mdm-packages";

export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "completed", "failed", "cancelled"]);
export const logLevelEnum = pgEnum("log_level", ["info", "success", "warning", "error", "debug"]);

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull().references(() => devicesTable.id),
  packageId: integer("package_id").notNull().references(() => mdmPackagesTable.id),
  status: jobStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  notes: text("notes"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const jobLogsTable = pgTable("job_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobsTable.id),
  level: logLevelEnum("level").notNull().default("info"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;

export const insertJobLogSchema = createInsertSchema(jobLogsTable).omit({ id: true, createdAt: true });
export type InsertJobLog = z.infer<typeof insertJobLogSchema>;
export type JobLog = typeof jobLogsTable.$inferSelect;
