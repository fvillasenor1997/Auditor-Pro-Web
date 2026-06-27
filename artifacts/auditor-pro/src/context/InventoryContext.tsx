import { createContext, useContext, useState, ReactNode } from "react";

export type ItemStatus = "Pendiente" | "Cuadrado" | "Sobrante" | "Faltante";

export interface InventoryItem {
  sku: string;
  description: string;
  category: string;
  theoretical: number;
  physical: number;
}

interface InventoryContextType {
  items: InventoryItem[];
  updatePhysicalCount: (sku: string, newCount: number) => void;
  resetInventory: () => void;
  activeInventoryName: string;
  setActiveInventoryName: (name: string) => void;
}

const mockData: InventoryItem[] = [
  { sku: "SKU-001", description: "Caja de Tornillos M8 x 50mm", category: "Ferretería", theoretical: 500, physical: 0 },
  { sku: "SKU-002", description: "Paleta de Madera 120x80cm", category: "Embalaje", theoretical: 75, physical: 0 },
  { sku: "SKU-003", description: "Cinta Adhesiva Industrial 50m", category: "Embalaje", theoretical: 200, physical: 0 },
  { sku: "SKU-004", description: "Guantes de Nitrilo Talla M", category: "Seguridad", theoretical: 1000, physical: 0 },
  { sku: "SKU-005", description: "Perno Hexagonal 3/4\"", category: "Ferretería", theoretical: 350, physical: 0 },
  { sku: "SKU-006", description: "Casco de Seguridad Amarillo", category: "Seguridad", theoretical: 45, physical: 0 },
  { sku: "SKU-007", description: "Carretilla Manual 300kg", category: "Equipamiento", theoretical: 12, physical: 0 },
  { sku: "SKU-008", description: "Film Stretch 500m", category: "Embalaje", theoretical: 80, physical: 0 },
  { sku: "SKU-009", description: "Llave Inglesa 12\"", category: "Herramientas", theoretical: 25, physical: 0 },
  { sku: "SKU-010", description: "Martillo 500g", category: "Herramientas", theoretical: 30, physical: 0 },
  { sku: "SKU-011", description: "Cable Eléctrico 2.5mm 100m", category: "Eléctrico", theoretical: 15, physical: 0 },
  { sku: "SKU-012", description: "Bombilla LED 12W E27", category: "Eléctrico", theoretical: 300, physical: 0 },
  { sku: "SKU-013", description: "Caja Plástica 40L", category: "Almacenaje", theoretical: 60, physical: 0 },
  { sku: "SKU-014", description: "Etiquetas Adhesivas A4", category: "Oficina", theoretical: 500, physical: 0 },
  { sku: "SKU-015", description: "Marcador Industrial Negro", category: "Oficina", theoretical: 150, physical: 0 },
];

const InventoryContext = createContext<InventoryContextType | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<InventoryItem[]>(mockData);
  const [activeInventoryName, setActiveInventoryName] = useState("Inventario Mayo 2025 - Almacén Central");

  const updatePhysicalCount = (sku: string, newCount: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.sku === sku ? { ...item, physical: Math.max(0, newCount) } : item
      )
    );
  };

  const resetInventory = () => {
    setItems(mockData);
  };

  return (
    <InventoryContext.Provider
      value={{
        items,
        updatePhysicalCount,
        resetInventory,
        activeInventoryName,
        setActiveInventoryName,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
}
