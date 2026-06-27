import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function seedAdminUser(): Promise<void> {
  try {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (existing.length > 0) return;

    const defaultPassword = "Admin123!";
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash,
      role: "admin",
    });

    logger.info(
      { username: "admin", password: defaultPassword },
      "🔑 Default admin user created — CHANGE THIS PASSWORD IN PRODUCTION"
    );
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}

seedAdminUser().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
