import { pgTable, text, serial, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deviceStatusEnum = pgEnum("device_status", ["online", "offline", "busy", "error"]);
export const deviceModeEnum = pgEnum("device_mode", ["normal", "fastboot", "recovery", "edl", "sideload"]);
export const bootloaderStatusEnum = pgEnum("bootloader_status", ["locked", "unlocked", "unknown"]);

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  serialNumber: text("serial_number").notNull().unique(),
  model: text("model").notNull(),
  brand: text("brand").notNull(),
  chipset: text("chipset").notNull(),
  androidVersion: text("android_version"),
  imei: text("imei"),
  status: deviceStatusEnum("status").notNull().default("offline"),
  mode: deviceModeEnum("mode").notNull().default("normal"),
  bootloaderStatus: bootloaderStatusEnum("bootloader_status").notNull().default("unknown"),
  agentConnected: boolean("agent_connected").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;
