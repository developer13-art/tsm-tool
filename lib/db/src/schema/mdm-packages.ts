import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mdmPackagesTable = pgTable("mdm_packages", {
  id: serial("id").primaryKey(),
  packageName: text("package_name").notNull().unique(),
  displayName: text("display_name").notNull(),
  vendor: text("vendor").notNull(),
  chipsets: text("chipsets").array().notNull().default([]),
  description: text("description").notNull().default(""),
});

export const insertMdmPackageSchema = createInsertSchema(mdmPackagesTable).omit({ id: true });
export type InsertMdmPackage = z.infer<typeof insertMdmPackageSchema>;
export type MdmPackage = typeof mdmPackagesTable.$inferSelect;
