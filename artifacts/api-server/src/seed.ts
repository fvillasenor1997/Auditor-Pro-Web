import { db, inventoriesTable, inventoryItemsTable, countRecordsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";

const DEMO_ITEMS = [
  { sku: "ELC-001", descripcion: 'Smart TV 55" 4K UHD', categoria: "Electrónica", cantidadTeorica: 12, precio: "1299.99" },
  { sku: "ELC-002", descripcion: "Laptop Gaming 16GB RAM", categoria: "Electrónica", cantidadTeorica: 8, precio: "899.50" },
  { sku: "ELC-003", descripcion: "Auriculares Bluetooth Pro", categoria: "Electrónica", cantidadTeorica: 25, precio: "149.00" },
  { sku: "ELC-004", descripcion: "Tablet 10 Pulgadas 128GB", categoria: "Electrónica", cantidadTeorica: 15, precio: "349.00" },
  { sku: "ELC-005", descripcion: "Cámara Digital 24MP", categoria: "Electrónica", cantidadTeorica: 6, precio: "599.00" },
  { sku: "HOG-001", descripcion: "Refrigeradora Inverter 400L", categoria: "Hogar", cantidadTeorica: 5, precio: "780.00" },
  { sku: "HOG-002", descripcion: "Lavadora Automática 12Kg", categoria: "Hogar", cantidadTeorica: 7, precio: "520.00" },
  { sku: "HOG-003", descripcion: "Microondas 30L Digital", categoria: "Hogar", cantidadTeorica: 18, precio: "189.99" },
  { sku: "HOG-004", descripcion: "Licuadora Industrial 1200W", categoria: "Hogar", cantidadTeorica: 30, precio: "85.00" },
  { sku: "HOG-005", descripcion: "Aspiradora Ciclónica 2000W", categoria: "Hogar", cantidadTeorica: 11, precio: "210.00" },
  { sku: "DEP-001", descripcion: "Bicicleta Mountain Bike 29\"", categoria: "Deportes", cantidadTeorica: 9, precio: "450.00" },
  { sku: "DEP-002", descripcion: "Pesas Hexagonales Set 20Kg", categoria: "Deportes", cantidadTeorica: 20, precio: "95.00" },
  { sku: "DEP-003", descripcion: "Cinta de Correr Eléctrica", categoria: "Deportes", cantidadTeorica: 4, precio: "680.00" },
  { sku: "ALI-001", descripcion: "Aceite de Oliva Extra Virgen 5L", categoria: "Alimentos", cantidadTeorica: 50, precio: "42.00" },
  { sku: "ALI-002", descripcion: "Café Premium Molido 1Kg", categoria: "Alimentos", cantidadTeorica: 80, precio: "28.50" },
  { sku: "HER-001", descripcion: "Taladro Percutor 800W", categoria: "Herramientas", cantidadTeorica: 14, precio: "125.00" },
  { sku: "HER-002", descripcion: "Set Llaves Torx 32 Piezas", categoria: "Herramientas", cantidadTeorica: 22, precio: "68.00" },
  { sku: "ROPAm-001", descripcion: "Camiseta Polo Algodón M", categoria: "Ropa", cantidadTeorica: 60, precio: "22.00" },
  { sku: "ROPAm-002", descripcion: "Jean Slim Fit 32x32", categoria: "Ropa", cantidadTeorica: 45, precio: "55.00" },
  { sku: "MED-001", descripcion: "Botiquín Primeros Auxilios Completo", categoria: "Salud", cantidadTeorica: 30, precio: "38.00" },
];

// Count records simulate two auditors who already worked
const DEMO_RECORDS = [
  // auditor1 — Pasillo A, Estante 1
  { skuIndex: 0, username: "auditor1", location: "Pasillo A - Estante 1", cantidad: 4, minsAgo: 45 },
  { skuIndex: 1, username: "auditor1", location: "Pasillo A - Estante 1", cantidad: 3, minsAgo: 42 },
  { skuIndex: 2, username: "auditor1", location: "Pasillo A - Estante 2", cantidad: 10, minsAgo: 38 },
  { skuIndex: 3, username: "auditor1", location: "Pasillo A - Estante 2", cantidad: 7, minsAgo: 35 },
  { skuIndex: 4, username: "auditor1", location: "Pasillo A - Estante 3", cantidad: 2, minsAgo: 30 },
  { skuIndex: 5, username: "auditor1", location: "Pasillo B - Estante 1", cantidad: 3, minsAgo: 25 },
  { skuIndex: 6, username: "auditor1", location: "Pasillo B - Estante 1", cantidad: 4, minsAgo: 22 },
  { skuIndex: 7, username: "auditor1", location: "Pasillo B - Estante 2", cantidad: 9, minsAgo: 18 },
  // auditor2 — Pasillo C
  { skuIndex: 8, username: "auditor2", location: "Pasillo C - Estante 1", cantidad: 15, minsAgo: 50 },
  { skuIndex: 9, username: "auditor2", location: "Pasillo C - Estante 1", cantidad: 6, minsAgo: 47 },
  { skuIndex: 10, username: "auditor2", location: "Pasillo C - Estante 2", cantidad: 5, minsAgo: 44 },
  { skuIndex: 11, username: "auditor2", location: "Pasillo C - Estante 2", cantidad: 12, minsAgo: 40 },
  { skuIndex: 12, username: "auditor2", location: "Pasillo D - Estante 1", cantidad: 2, minsAgo: 35 },
  { skuIndex: 13, username: "auditor2", location: "Pasillo D - Estante 1", cantidad: 25, minsAgo: 30 },
  { skuIndex: 14, username: "auditor2", location: "Pasillo D - Estante 2", cantidad: 40, minsAgo: 25 },
  { skuIndex: 2, username: "auditor2", location: "Pasillo D - Estante 2", cantidad: 15, minsAgo: 20 },
  // a second scan by auditor1 on same item (to demo multiple records per SKU)
  { skuIndex: 0, username: "auditor1", location: "Pasillo A - Estante 4", cantidad: 8, minsAgo: 10 },
  { skuIndex: 1, username: "auditor1", location: "Pasillo A - Estante 4", cantidad: 5, minsAgo: 8 },
];

export async function seedDemoData(log: Logger): Promise<void> {
  try {
    const existing = await db.select({ id: inventoriesTable.id }).from(inventoriesTable).limit(1);
    if (existing.length > 0) return;

    // Create demo inventory
    const today = new Date().toISOString().split("T")[0]!;
    const [inv] = await db
      .insert(inventoriesTable)
      .values({ name: "Inventario Demo — Almacén Central", location: "Almacén Central", date: today })
      .returning();

    if (!inv) return;

    // Insert items
    const insertedItems = await db
      .insert(inventoryItemsTable)
      .values(DEMO_ITEMS.map((item) => ({ ...item, inventoryId: inv.id, cantidadFisica: 0 })))
      .returning();

    // Ensure demo auditor users exist
    const demoUsers = [
      { username: "auditor1", role: "auditor" as const },
      { username: "auditor2", role: "auditor" as const },
    ];

    const bcrypt = await import("bcryptjs");
    for (const u of demoUsers) {
      const existingUser = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, u.username)).limit(1);
      if (existingUser.length === 0) {
        const passwordHash = await bcrypt.hash("Auditor123!", 12);
        await db.insert(usersTable).values({ username: u.username, passwordHash, role: u.role });
      }
    }

    // Insert count records and update cantidadFisica
    const now = Date.now();
    const fisicaMap = new Map<number, number>();

    for (const rec of DEMO_RECORDS) {
      const item = insertedItems[rec.skuIndex];
      if (!item) continue;

      await db.insert(countRecordsTable).values({
        inventoryId: inv.id,
        itemId: item.id,
        username: rec.username,
        location: rec.location,
        cantidad: rec.cantidad,
        timestamp: new Date(now - rec.minsAgo * 60 * 1000),
      });

      fisicaMap.set(item.id, (fisicaMap.get(item.id) ?? 0) + rec.cantidad);
    }

    // Update cantidadFisica for items that have records
    for (const [itemId, total] of fisicaMap.entries()) {
      await db
        .update(inventoryItemsTable)
        .set({ cantidadFisica: total })
        .where(eq(inventoryItemsTable.id, itemId));
    }

    log.info({ inventoryId: inv.id, items: insertedItems.length }, "🌱 Demo inventory seeded");
  } catch (err) {
    log.error({ err }, "Failed to seed demo data");
  }
}
