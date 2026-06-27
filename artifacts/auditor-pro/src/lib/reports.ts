import type { CachedItem } from "./db";

type ItemStatus = "Pendiente" | "Cuadrado" | "Sobrante" | "Faltante";

function getStatus(item: CachedItem): ItemStatus {
  if (item.cantidadFisica === 0) return "Pendiente";
  if (item.cantidadFisica === item.cantidadTeorica) return "Cuadrado";
  if (item.cantidadFisica > item.cantidadTeorica) return "Sobrante";
  return "Faltante";
}

function precisionPct(items: CachedItem[]): number {
  const counted = items.filter((i) => i.cantidadFisica > 0 || i.cantidadTeorica > 0);
  if (counted.length === 0) return 0;
  const cuadrados = counted.filter((i) => getStatus(i) === "Cuadrado").length;
  return (cuadrados / counted.length) * 100;
}

// ─── PDF Report ────────────────────────────────────────────────────────────────

export async function generateInventoryPDF(
  items: CachedItem[],
  inventoryName: string,
  inventoryLocation: string,
  inventoryDate: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const faltantes = items.filter((i) => getStatus(i) === "Faltante");
  const sobrantes = items.filter((i) => getStatus(i) === "Sobrante");
  const cuadrados = items.filter((i) => getStatus(i) === "Cuadrado");
  const pendientes = items.filter((i) => getStatus(i) === "Pendiente");
  const prec = precisionPct(items);

  // ── Page 1: Header + Summary ───────────────────────────────────────────────
  const DARK = [15, 23, 42] as [number, number, number];
  const RED = [220, 38, 38] as [number, number, number];
  const AMBER = [180, 100, 0] as [number, number, number];
  const GREEN = [5, 150, 105] as [number, number, number];

  // Top bar
  doc.setFillColor(...DARK);
  doc.rect(0, 0, 210, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Reporte de Auditoría de Inventario", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 230);
  doc.text("Auditor Pro — Sistema Profesional de Inventarios", 14, 20);

  // Inventory details
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(inventoryName, 14, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Ubicación: ${inventoryLocation || "—"}`, 14, 45);
  doc.text(`Fecha de auditoría: ${inventoryDate || "—"}`, 14, 51);
  doc.text(`Generado: ${new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}`, 14, 57);

  // Precision circle area
  const precColor: [number, number, number] =
    prec >= 90 ? GREEN : prec >= 70 ? AMBER : RED;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...precColor);
  doc.text(`${prec.toFixed(1)}%`, 155, 48, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Precisión global", 155, 56, { align: "center" });

  doc.setTextColor(30, 30, 30);

  // Summary table
  autoTable(doc, {
    startY: 66,
    head: [["Total Ítems", "Cuadrados ✓", "Sobrantes ▲", "Faltantes ▼", "Pendientes —"]],
    body: [
      [
        items.length,
        `${cuadrados.length} (${items.length > 0 ? ((cuadrados.length / items.length) * 100).toFixed(1) : 0}%)`,
        sobrantes.length,
        faltantes.length,
        pendientes.length,
      ],
    ],
    styles: { fontSize: 10, halign: "center" as const, cellPadding: 4 },
    headStyles: { fillColor: DARK, textColor: [255, 255, 255], fontStyle: "bold" },
    bodyStyles: { textColor: [30, 30, 30] },
    columnStyles: {
      1: { textColor: [5, 150, 105] as [number, number, number] },
      2: { textColor: AMBER },
      3: { textColor: RED },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Faltantes table ────────────────────────────────────────────────────────
  if (faltantes.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastY: number = (doc as any).lastAutoTable?.finalY ?? 90;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...RED);
    doc.text(`▼ Artículos Faltantes (${faltantes.length})`, 14, lastY + 12);
    doc.setTextColor(30, 30, 30);

    autoTable(doc, {
      startY: lastY + 17,
      head: [["SKU", "Descripción", "Categoría", "Teórico", "Físico", "Diferencia"]],
      body: faltantes.map((i) => [
        i.sku,
        i.descripcion,
        i.categoria,
        i.cantidadTeorica,
        i.cantidadFisica,
        `−${i.cantidadTeorica - i.cantidadFisica}`,
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: "bold" },
        3: { halign: "right" as const },
        4: { halign: "right" as const },
        5: { halign: "right" as const, textColor: RED, fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
      alternateRowStyles: { fillColor: [255, 245, 245] },
    });
  }

  // ── Sobrantes table ────────────────────────────────────────────────────────
  if (sobrantes.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastY: number = (doc as any).lastAutoTable?.finalY ?? 90;
    const needsPage = lastY > 225;
    if (needsPage) doc.addPage();
    const sY = needsPage ? 20 : lastY + 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...AMBER);
    doc.text(`▲ Artículos Sobrantes (${sobrantes.length})`, 14, sY);
    doc.setTextColor(30, 30, 30);

    autoTable(doc, {
      startY: sY + 5,
      head: [["SKU", "Descripción", "Categoría", "Teórico", "Físico", "Diferencia"]],
      body: sobrantes.map((i) => [
        i.sku,
        i.descripcion,
        i.categoria,
        i.cantidadTeorica,
        i.cantidadFisica,
        `+${i.cantidadFisica - i.cantidadTeorica}`,
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [180, 110, 10], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 24, fontStyle: "bold" },
        3: { halign: "right" as const },
        4: { halign: "right" as const },
        5: { halign: "right" as const, textColor: AMBER, fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
      alternateRowStyles: { fillColor: [255, 251, 235] },
    });
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Auditor Pro — ${inventoryName} | Pág. ${p} de ${pageCount}`,
      14,
      291
    );
    doc.text(new Date().toLocaleDateString("es-ES"), 196, 291, { align: "right" });
  }

  // ── Download / share ───────────────────────────────────────────────────────
  const fileName = `reporte-${inventoryName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;

  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator
  ) {
    const blob = doc.output("blob");
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Reporte ${inventoryName}` });
        return;
      } catch {
        // user cancelled or not supported — fall through to download
      }
    }
  }

  doc.save(fileName);
}

// ─── Excel Export ──────────────────────────────────────────────────────────────

export async function generateInventoryExcel(
  items: CachedItem[],
  inventoryName: string,
  inventoryDate: string
): Promise<void> {
  const { utils, writeFile } = await import("xlsx");

  const rows = items.map((item) => ({
    SKU: item.sku,
    Descripción: item.descripcion,
    Categoría: item.categoria,
    Precio: Number(item.precio ?? 0),
    Teórico: item.cantidadTeorica,
    Físico: item.cantidadFisica,
    Diferencia: item.cantidadFisica - item.cantidadTeorica,
    Estado: getStatus(item),
  }));

  const ws = utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 16 }, // SKU
    { wch: 34 }, // Descripción
    { wch: 18 }, // Categoría
    { wch: 10 }, // Precio
    { wch: 10 }, // Teórico
    { wch: 10 }, // Físico
    { wch: 12 }, // Diferencia
    { wch: 12 }, // Estado
  ];

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Consolidación");

  // Summary sheet
  const summary = [
    ["Inventario", inventoryName],
    ["Fecha", inventoryDate],
    ["Total Ítems", items.length],
    ["Cuadrados", items.filter((i) => getStatus(i) === "Cuadrado").length],
    ["Sobrantes", items.filter((i) => getStatus(i) === "Sobrante").length],
    ["Faltantes", items.filter((i) => getStatus(i) === "Faltante").length],
    ["Pendientes", items.filter((i) => getStatus(i) === "Pendiente").length],
    ["Precisión (%)", Number(precisionPct(items).toFixed(2))],
    ["Generado", new Date().toLocaleString("es-ES")],
  ];
  const wsSummary = utils.aoa_to_sheet(summary);
  wsSummary["!cols"] = [{ wch: 18 }, { wch: 28 }];
  utils.book_append_sheet(wb, wsSummary, "Resumen");

  const fileName = `inventario-${inventoryName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  writeFile(wb, fileName);
}
