import bcrypt from "bcryptjs";
import { db, usersTable, mdmPackagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedDefaultData() {
  // Create default admin user
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, "iliyasu"));
  if (!existing) {
    const passwordHash = await bcrypt.hash("12123434", 10);
    await db.insert(usersTable).values({
      username: "iliyasu",
      email: "iliyasu@tsmpro.local",
      passwordHash,
      role: "admin",
    });
    logger.info("Default admin user created: iliyasu");
  }

  // Ensure MDM packages exist
  const pkgCount = await db.select().from(mdmPackagesTable);
  if (pkgCount.length === 0) {
    await db.insert(mdmPackagesTable).values([
      {
        packageName: "com.android.settings.devicelock",
        displayName: "Device Lock Controller",
        vendor: "Google/OEM",
        chipsets: ["Qualcomm", "MediaTek", "Exynos"],
        description: "Google Device Lock policy manager used by carriers for device financing programs",
      },
      {
        packageName: "com.samsung.android.mdm",
        displayName: "Samsung MDM Agent",
        vendor: "Samsung",
        chipsets: ["Exynos", "Snapdragon"],
        description: "Samsung enterprise mobile device management agent",
      },
      {
        packageName: "com.microsoft.intune",
        displayName: "Microsoft Intune",
        vendor: "Microsoft",
        chipsets: ["Qualcomm", "MediaTek", "Exynos", "Kirin"],
        description: "Microsoft Intune enterprise mobility management",
      },
      {
        packageName: "com.tecno.security.mdm",
        displayName: "Tecno MDM Agent",
        vendor: "Tecno Mobile",
        chipsets: ["MediaTek", "Helio"],
        description: "Tecno device finance and security lock agent",
      },
      {
        packageName: "com.xiaomi.mtbservice",
        displayName: "Xiaomi MTB Service",
        vendor: "Xiaomi",
        chipsets: ["Qualcomm", "MediaTek"],
        description: "Xiaomi mobile track and block service",
      },
    ]);
    logger.info("Default MDM packages seeded");
  }
}
