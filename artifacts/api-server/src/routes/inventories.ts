import path from "path";
import fs from "fs";
import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { eq, and } from "drizzle-orm";
import { db, inventoriesTable, inventoryItemsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls");
    if (!ok) {
      cb(new Error("Only Excel files (.xlsx, .xls) are accepted"));
      return;
    }
    cb(null, true);
  },
});

router.get("/inventories", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(inventoriesTable)
    .orderBy(inventoriesTable.createdAt);

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post(
  "/inventories/upload",
  requireAuth,
  requireAdmin,
  upload.single("file"),
  async (req, res): Promise<void> => {
    const { name, location, date } = req.body as {
      name?: string;
      location?: string;
      date?: string;
    };

    if (!name || !location || !date) {
      res.status(400).json({ error: "name, location and date are required" });
      return;
    }

    let items: Array<{
      sku: string;
      descripcion: string;
      categoria: string;
      cantidadTeorica: number;
    }> = [];

    if (req.file) {
      try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("Empty workbook");
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet!);

        items = rows.map((row) => ({
          sku: String(row["SKU"] ?? row["sku"] ?? ""),
          descripcion: String(row["Descripcion"] ?? row["descripcion"] ?? row["Descripción"] ?? row["descripción"] ?? ""),
          categoria: String(row["Categoria"] ?? row["categoria"] ?? row["Categoría"] ?? row["categoría"] ?? ""),
          cantidadTeorica: Number(row["Teorico"] ?? row["teorico"] ?? row["Teórico"] ?? row["teórico"] ?? row["CantidadTeorica"] ?? row["cantidad_teorica"] ?? 0),
        })).filter((item) => item.sku);

        fs.unlinkSync(req.file.path);
      } catch (err) {
        req.log.error({ err }, "Failed to parse Excel file");
        res.status(400).json({ error: "Could not parse Excel file. Ensure it has columns: SKU, Descripcion, Categoria, Teorico" });
        return;
      }
    }

    const [inventory] = await db
      .insert(inventoriesTable)
      .values({ name, location, date })
      .returning();

    if (!inventory) {
      res.status(500).json({ error: "Failed to create inventory" });
      return;
    }

    let insertedItems: typeof inventoryItemsTable.$inferSelect[] = [];
    if (items.length > 0) {
      insertedItems = await db
        .insert(inventoryItemsTable)
        .values(items.map((item) => ({ ...item, inventoryId: inventory.id })))
        .returning();
    }

    logger.info({ inventoryId: inventory.id, itemCount: insertedItems.length }, "Inventory created");

    res.status(201).json({
      ...inventory,
      createdAt: inventory.createdAt.toISOString(),
      items: insertedItems,
    });
  }
);

router.get("/inventories/:inventoryId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.inventoryId)
    ? req.params.inventoryId[0]
    : req.params.inventoryId;
  const inventoryId = parseInt(rawId ?? "", 10);

  if (isNaN(inventoryId)) {
    res.status(400).json({ error: "Invalid inventoryId" });
    return;
  }

  const [inventory] = await db
    .select()
    .from(inventoriesTable)
    .where(eq(inventoriesTable.id, inventoryId));

  if (!inventory) {
    res.status(404).json({ error: "Inventory not found" });
    return;
  }

  const rawItems = await db
    .select()
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.inventoryId, inventoryId));

  // Blind counting for auditors: hide cantidadTeorica
  const isAuditor = req.user?.role === "auditor";
  const items = isAuditor
    ? rawItems.map((item) => ({ ...item, cantidadTeorica: 0 }))
    : rawItems;

  res.json({
    ...inventory,
    createdAt: inventory.createdAt.toISOString(),
    items,
  });
});

router.patch(
  "/inventories/:inventoryId/items/:itemId",
  requireAuth,
  async (req, res): Promise<void> => {
    const rawInvId = Array.isArray(req.params.inventoryId)
      ? req.params.inventoryId[0]
      : req.params.inventoryId;
    const rawItemId = Array.isArray(req.params.itemId)
      ? req.params.itemId[0]
      : req.params.itemId;

    const inventoryId = parseInt(rawInvId ?? "", 10);
    const itemId = parseInt(rawItemId ?? "", 10);

    if (isNaN(inventoryId) || isNaN(itemId)) {
      res.status(400).json({ error: "Invalid id parameters" });
      return;
    }

    const { cantidadFisica } = req.body as { cantidadFisica?: unknown };
    if (cantidadFisica === undefined || typeof cantidadFisica !== "number" || cantidadFisica < 0) {
      res.status(400).json({ error: "cantidadFisica must be a non-negative number" });
      return;
    }

    const [updated] = await db
      .update(inventoryItemsTable)
      .set({ cantidadFisica })
      .where(
        and(
          eq(inventoryItemsTable.id, itemId),
          eq(inventoryItemsTable.inventoryId, inventoryId)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json(updated);
  }
);

export default router;
