import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  Save,
  Search,
  Loader2,
  AlertCircle,
  ScanBarcode,
  Users,
  History,
  MapPin,
  Clock,
  X,
  Trash2,
  ArrowLeftRight,
  Wifi,
  WifiOff,
  Download,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  FileText,
  FileSpreadsheet,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useInventorySync } from "@/hooks/useInventorySync";
import { usePWAStatus } from "@/hooks/usePWAStatus";
import type { CachedItem } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/auth";
import { generateInventoryPDF, generateInventoryExcel } from "@/lib/reports";
import { useAuth } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL;

type ItemStatus = "Pendiente" | "Cuadrado" | "Sobrante" | "Faltante";

const getItemStatus = (item: CachedItem): ItemStatus => {
  if (item.cantidadFisica === 0) return "Pendiente";
  if (item.cantidadFisica === item.cantidadTeorica) return "Cuadrado";
  if (item.cantidadFisica > item.cantidadTeorica) return "Sobrante";
  return "Faltante";
};

const StatusBadge = ({ status }: { status: ItemStatus }) => {
  switch (status) {
    case "Cuadrado":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 text-xs whitespace-nowrap">Cuadrado</Badge>;
    case "Sobrante":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs whitespace-nowrap">Sobrante</Badge>;
    case "Faltante":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200 text-xs whitespace-nowrap">Faltante</Badge>;
    default:
      return <Badge variant="outline" className="text-slate-500 bg-slate-50 text-xs whitespace-nowrap">Pendiente</Badge>;
  }
};

interface CountRecord {
  id: number;
  username: string;
  location: string;
  cantidad: number;
  timestamp: string;
}

interface Participant {
  username: string;
  lastActivity: string | null;
  totalRecords: number;
}

interface LocationRow {
  id: number;
  inventoryId: number;
  name: string;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

// ─── SW Status Badge ─────────────────────────────────────────────────────────

function SWBadge() {
  const pwaStatus = usePWAStatus();
  if (pwaStatus === "unsupported" || pwaStatus === "checking") return null;
  if (pwaStatus === "installing") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-300 font-medium" title="Descargando para uso offline...">
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span className="hidden lg:inline">Descargando</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium" title="Listo para trabajar sin conexión">
      <Wifi className="w-3.5 h-3.5" />
      <span className="hidden lg:inline">Offline listo</span>
    </span>
  );
}

// ─── History Modal ──────────────────────────────────────────────────────────────

function HistoryModal({
  item,
  inventoryId,
  onClose,
}: {
  item: CachedItem;
  inventoryId: number;
  onClose: () => void;
}) {
  const [records, setRecords] = useState<CountRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    let active = true;
    fetch(`${BASE}api/inventories/${inventoryId}/items/${item.id}/records`, {
      headers: authHeaders(),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: CountRecord[]) => {
        if (active) setRecords(data);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los registros.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-start justify-between px-4 sm:px-6 py-4 border-b border-slate-200">
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 shrink-0" />
              Detalle de Conteo
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">
              <span className="font-mono">{item.sku}</span> — {item.descripcion}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-12 text-rose-500 gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}
          {records !== null && records.length === 0 && (
            <p className="text-center text-slate-500 py-12 text-sm">
              Aún no hay registros de conteo para este producto.
            </p>
          )}
          {records !== null && records.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Auditor</TableHead>
                    <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Locación</TableHead>
                    <TableHead className="text-right font-semibold text-slate-900 whitespace-nowrap">Cantidad</TableHead>
                    <TableHead className="font-semibold text-slate-900 whitespace-nowrap">Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-slate-800 whitespace-nowrap">@{r.username}</TableCell>
                      <TableCell className="text-slate-600">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {r.location}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-slate-900">
                        +{r.cantidad}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                        {formatTime(r.timestamp)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {records !== null && records.length > 0 && (
          <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-xl">
            <span className="text-sm text-slate-500">{records.length} registro{records.length !== 1 ? "s" : ""}</span>
            <span className="text-sm font-semibold text-slate-900">
              Total:{" "}
              <span className="font-mono">{records.reduce((s, r) => s + r.cantidad, 0)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Participants Modal ─────────────────────────────────────────────────────────

function ParticipantsModal({
  inventoryId,
  onClose,
}: {
  inventoryId: number;
  onClose: () => void;
}) {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    let active = true;
    fetch(`${BASE}api/inventories/${inventoryId}/participants`, {
      headers: authHeaders(),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Participant[]) => {
        if (active) setParticipants(data);
      })
      .catch(() => {
        if (active) setError("No se pudieron cargar los participantes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            Participantes
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 max-h-[60vh] overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center py-10 text-rose-500 gap-2 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {participants !== null && participants.length === 0 && (
            <p className="text-center text-slate-500 py-10 text-sm">
              Aún no hay conteos registrados en esta auditoría.
            </p>
          )}
          {participants !== null && participants.length > 0 && (
            <div className="space-y-3">
              {participants.map((p) => (
                <div
                  key={p.username}
                  className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {p.username[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">@{p.username}</p>
                      <p className="text-xs text-slate-500">{p.totalRecords} registro{p.totalRecords !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      Último
                    </p>
                    <p className="text-xs font-medium text-slate-700">
                      {formatTime(p.lastActivity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Locations Modal ──────────────────────────────────────────────────────────

function LocationsModal({
  inventoryId,
  onClose,
}: {
  inventoryId: number;
  onClose: () => void;
}) {
  const [locations, setLocations] = useState<LocationRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${BASE}api/inventories/${inventoryId}/locations`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: LocationRow[]) => setLocations(data))
      .catch(() => setError("Error al cargar locaciones."))
      .finally(() => setLoading(false));
  }, [inventoryId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`${BASE}api/inventories/${inventoryId}/locations`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!r.ok) throw new Error();
      setNewName("");
      load();
    } catch {
      setError("No se pudo crear la locación.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (locId: number) => {
    try {
      await fetch(`${BASE}api/inventories/${inventoryId}/locations/${locId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      load();
    } catch {
      setError("No se pudo eliminar la locación.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
            Locaciones
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
          <p className="text-xs text-slate-500 mb-3">Los auditores solo pueden elegir de esta lista al momento de contar.</p>
          <div className="flex gap-2">
            <Input
              placeholder="Ej: Pasillo A - Estante 1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              className="flex-1"
              maxLength={80}
            />
            <Button onClick={handleAdd} disabled={!newName.trim() || saving} size="sm" className="shrink-0">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Agregar"}
            </Button>
          </div>
          {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
        </div>

        <div className="flex-1 overflow-auto px-4 sm:px-6 py-3">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
          {!loading && locations !== null && locations.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">
              No hay locaciones creadas aún.
            </p>
          )}
          {!loading && locations !== null && locations.length > 0 && (
            <div className="space-y-1">
              {locations.map((loc) => (
                <div key={loc.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors group">
                  <span className="flex items-center gap-2 text-sm text-slate-700 min-w-0 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {loc.name}
                  </span>
                  <button
                    onClick={() => handleDelete(loc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all shrink-0 ml-2"
                    title="Eliminar locación"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <p className="text-xs text-slate-400">
            {locations?.length ?? 0} locación{(locations?.length ?? 0) !== 1 ? "es" : ""} registrada{(locations?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Swapped Codes Detection ──────────────────────────────────────────────────

interface DiscrepancyGroup {
  /** absolute difference value, e.g. 1, 2, 5 */
  diff: number;
  surplus: Array<{ item: CachedItem; qty: number }>;
  deficit: Array<{ item: CachedItem; qty: number }>;
}

function detectSwappedGroups(items: CachedItem[]): DiscrepancyGroup[] {
  const map = new Map<number, DiscrepancyGroup>();

  for (const item of items) {
    const d = item.cantidadFisica - item.cantidadTeorica;
    if (d === 0) continue;
    // Only include deficit items that have been counted (cantidadFisica > 0)
    if (d < 0 && item.cantidadFisica === 0) continue;

    const key = Math.abs(d);
    if (!map.has(key)) {
      map.set(key, { diff: key, surplus: [], deficit: [] });
    }
    const group = map.get(key)!;
    if (d > 0) {
      group.surplus.push({ item, qty: d });
    } else {
      group.deficit.push({ item, qty: Math.abs(d) });
    }
  }

  // Only keep groups that have BOTH surplus and deficit items (potential swaps)
  return [...map.values()]
    .filter((g) => g.surplus.length > 0 && g.deficit.length > 0)
    .sort((a, b) => a.diff - b.diff);
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const params = useParams<{ id: string }>();
  const inventoryId = parseInt(params.id ?? "", 10);
  const { toast } = useToast();

  const { user } = useAuth();
  const { items, inventory, status, pendingCount, forceSync } =
    useInventorySync(inventoryId);

  const [search, setSearch] = useState("");
  const [historyItem, setHistoryItem] = useState<CachedItem | null>(null);
  // ── Adjustment modal ──
  const [adjustTarget, setAdjustTarget] = useState<CachedItem | null>(null);
  const [adjustValue, setAdjustValue] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  // ── Cards visibility toggle ──
  const [cardsVisible, setCardsVisible] = useState(true);
  // ── Report loading states ──
  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lower = search.toLowerCase();
    return items.filter(
      (item) =>
        item.sku.toLowerCase().includes(lower) ||
        item.descripcion.toLowerCase().includes(lower)
    );
  }, [items, search]);

  const pendientes = filteredItems.filter((i) => getItemStatus(i) === "Pendiente");
  const cuadrados = filteredItems.filter((i) => getItemStatus(i) === "Cuadrado");
  const sobrantes = filteredItems.filter((i) => getItemStatus(i) === "Sobrante");
  const faltantes = filteredItems.filter((i) => getItemStatus(i) === "Faltante");

  const totalCuadrados = items.filter((i) => getItemStatus(i) === "Cuadrado").length;
  const totalSobrantes = items.filter((i) => getItemStatus(i) === "Sobrante").length;
  const totalFaltantes = items.filter((i) => getItemStatus(i) === "Faltante").length;

  const swappedGroups = useMemo(() => detectSwappedGroups(items), [items]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

  const valorTotal = items.reduce((s, i) => s + Number(i.precio ?? 0) * i.cantidadTeorica, 0);
  const valorCuadrados = items
    .filter((i) => getItemStatus(i) === "Cuadrado")
    .reduce((s, i) => s + Number(i.precio ?? 0) * i.cantidadFisica, 0);
  const valorSobrantes = items
    .filter((i) => getItemStatus(i) === "Sobrante")
    .reduce((s, i) => s + Number(i.precio ?? 0) * (i.cantidadFisica - i.cantidadTeorica), 0);
  const valorFaltantes = items
    .filter((i) => getItemStatus(i) === "Faltante")
    .reduce((s, i) => s + Number(i.precio ?? 0) * (i.cantidadTeorica - i.cantidadFisica), 0);

  const openAdjust = (item: CachedItem) => {
    setAdjustTarget(item);
    setAdjustValue(String(item.cantidadFisica));
  };

  const handleAdjustSubmit = async () => {
    if (!adjustTarget) return;
    const newQty = parseInt(adjustValue, 10);
    if (isNaN(newQty) || newQty < 0) {
      toast({ title: "Cantidad inválida", description: "Ingrese un número entero mayor o igual a cero.", variant: "destructive" });
      return;
    }
    setAdjusting(true);
    try {
      const username = user?.username ?? "admin";
      const res = await fetch(
        `${BASE}api/inventories/${inventoryId}/items/${adjustTarget.id}/records`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            username,
            location: "Ajuste Admin",
            cantidad: newQty,
            timestamp: new Date().toISOString(),
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al guardar ajuste");
      }
      toast({
        title: "Ajuste guardado",
        description: `${adjustTarget.sku} — cantidad física actualizada a ${newQty}.`,
      });
      setAdjustTarget(null);
      // Refresh inventory from server so cantidadFisica reflects the adjustment
      await forceSync();
    } catch (err) {
      toast({
        title: "Error al ajustar",
        description: err instanceof Error ? err.message : "Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setAdjusting(false);
    }
  };

  const handleExportPDF = async () => {
    if (items.length === 0) {
      toast({ title: "Sin datos", description: "No hay artículos para generar el reporte.", variant: "destructive" });
      return;
    }
    const invName = inventory?.name ?? `Inventario #${inventoryId}`;
    const invLocation = inventory?.location ?? "";
    const invDate = inventory?.date ?? "";
    setPdfLoading(true);
    try {
      await generateInventoryPDF(items, invName, invLocation, invDate);
    } catch {
      toast({ title: "Error al generar PDF", description: "Intente nuevamente.", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (items.length === 0) {
      toast({ title: "Sin datos", description: "No hay artículos para exportar.", variant: "destructive" });
      return;
    }
    const invName = inventory?.name ?? `Inventario #${inventoryId}`;
    const invDate = inventory?.date ?? "";
    setExcelLoading(true);
    try {
      await generateInventoryExcel(items, invName, invDate);
    } catch {
      toast({ title: "Error al exportar Excel", description: "Intente nuevamente.", variant: "destructive" });
    } finally {
      setExcelLoading(false);
    }
  };

  const handleSave = async () => {
    if (pendingCount > 0 && navigator.onLine) {
      await forceSync();
      toast({ title: "Sincronizado", description: "Todos los cambios han sido enviados al servidor." });
    } else if (pendingCount > 0) {
      toast({ title: "Sin conexión", description: `${pendingCount} cambios guardados localmente.`, variant: "destructive" });
    } else {
      toast({ title: "Todo guardado", description: "No hay cambios pendientes." });
    }
  };

  const today = new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date());

  const renderTable = useCallback(
    (data: CachedItem[]) => (
      <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <Table className="min-w-[700px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead className="w-[100px] font-semibold text-slate-900 whitespace-nowrap">SKU</TableHead>
                <TableHead className="font-semibold text-slate-900">Descripción</TableHead>
                <TableHead className="w-[110px] font-semibold text-slate-900 whitespace-nowrap hidden md:table-cell">Categoría</TableHead>
                <TableHead className="w-[80px] text-right font-semibold text-slate-900 whitespace-nowrap hidden sm:table-cell">Precio</TableHead>
                <TableHead className="w-[80px] text-right font-semibold text-slate-900 whitespace-nowrap">Teórico</TableHead>
                <TableHead className="w-[80px] text-right font-semibold text-slate-900 whitespace-nowrap">Físico</TableHead>
                <TableHead className="w-[100px] text-center font-semibold text-slate-900 whitespace-nowrap">Estado</TableHead>
                <TableHead className="w-[120px] text-center font-semibold text-slate-900">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                    No hay registros en esta vista.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                    <TableCell className="font-medium font-mono text-xs whitespace-nowrap">{item.sku}</TableCell>
                    <TableCell className="text-slate-700 font-medium min-w-[140px]">{item.descripcion}</TableCell>
                    <TableCell className="text-slate-500 text-sm whitespace-nowrap hidden md:table-cell">{item.categoria}</TableCell>
                    <TableCell className="text-right text-slate-600 font-mono text-sm whitespace-nowrap hidden sm:table-cell">
                      {Number(item.precio ?? 0) > 0 ? `$${Number(item.precio).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-slate-500 font-mono whitespace-nowrap">{item.cantidadTeorica}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-base text-slate-900 whitespace-nowrap">
                      {item.cantidadFisica}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={getItemStatus(item)} />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300"
                          onClick={() => openAdjust(item)}
                          data-testid={`btn-adjust-${item.id}`}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                          Ajuste
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          onClick={() => setHistoryItem(item)}
                          title="Ver historial"
                          data-testid={`btn-history-${item.id}`}
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    ),
    [openAdjust, setHistoryItem]
  );


  if (isNaN(inventoryId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">ID de inventario inválido.</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  if (status === "error" && items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-700 font-semibold">No se encontró el inventario</p>
          <p className="text-slate-500 text-sm mt-1">Verifique su conexión o el ID del inventario.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-slate-500 underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const inventoryName = inventory?.name ?? `Inventario #${inventoryId}`;
  const inventoryLocation = inventory?.location ?? "";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* ── Adjustment Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!adjustTarget} onOpenChange={(o) => { if (!o && !adjusting) setAdjustTarget(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-violet-600" />
              Ajuste de Inventario
            </DialogTitle>
            <DialogDescription>
              Esta acción se guardará como transacción en el historial del artículo.
            </DialogDescription>
          </DialogHeader>
          {adjustTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="font-mono font-bold text-slate-900 text-xs">{adjustTarget.sku}</p>
                <p className="text-slate-700 mt-0.5">{adjustTarget.descripcion}</p>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>Teórico: <span className="font-semibold text-slate-700">{adjustTarget.cantidadTeorica}</span></span>
                  <span>Físico actual: <span className="font-semibold text-slate-700">{adjustTarget.cantidadFisica}</span></span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adj-qty" className="text-sm font-medium">Nueva cantidad física</Label>
                <Input
                  id="adj-qty"
                  type="number"
                  min={0}
                  step={1}
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdjustSubmit(); }}
                  className="text-lg font-mono font-semibold h-11 text-center"
                  autoFocus
                />
                {adjustValue !== "" && !isNaN(parseInt(adjustValue)) && (
                  <p className="text-xs text-slate-500 text-center">
                    {parseInt(adjustValue) > adjustTarget.cantidadFisica
                      ? <span className="text-amber-600">▲ +{parseInt(adjustValue) - adjustTarget.cantidadFisica} unidades respecto al actual</span>
                      : parseInt(adjustValue) < adjustTarget.cantidadFisica
                      ? <span className="text-rose-600">▼ −{adjustTarget.cantidadFisica - parseInt(adjustValue)} unidades respecto al actual</span>
                      : <span className="text-slate-400">Sin cambio</span>
                    }
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAdjustTarget(null)} disabled={adjusting}>
              Cancelar
            </Button>
            <Button
              onClick={handleAdjustSubmit}
              disabled={adjusting || adjustValue === ""}
              className="bg-violet-700 hover:bg-violet-800 text-white"
            >
              {adjusting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
              ) : (
                <><SlidersHorizontal className="w-4 h-4 mr-2" />Guardar Ajuste</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      {historyItem && (
        <HistoryModal
          item={historyItem}
          inventoryId={inventoryId}
          onClose={() => setHistoryItem(null)}
        />
      )}
      {showParticipants && (
        <ParticipantsModal
          inventoryId={inventoryId}
          onClose={() => setShowParticipants(false)}
        />
      )}
      {showLocations && (
        <LocationsModal
          inventoryId={inventoryId}
          onClose={() => setShowLocations(false)}
        />
      )}

      {/* Offline warning banner */}
      {status === "offline" && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-semibold" data-testid="banner-offline">
          Modo sin conexión — Los cambios se guardan localmente y se sincronizarán al reconectarse.
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
        <div className="px-3 sm:px-5 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Left */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/admin" className="p-1.5 hover:bg-slate-800 rounded-md transition-colors shrink-0" data-testid="link-back">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-sm font-bold leading-none tracking-tight">Auditor Pro</h1>
              <p className="text-xs text-slate-400 font-medium truncate max-w-[160px] lg:max-w-xs">
                {inventoryName}{inventoryLocation ? ` — ${inventoryLocation}` : ""}
              </p>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <SWBadge />
            <OfflineIndicator status={status} pendingCount={pendingCount} onSync={forceSync} />

            {/* Locations — icon on mobile */}
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-300 hover:bg-slate-800 hover:text-white h-8 w-8 sm:w-auto sm:px-3"
              onClick={() => setShowLocations(true)}
              title="Locaciones"
            >
              <MapPin className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-xs font-semibold">Locaciones</span>
            </Button>

            {/* Participants — icon on mobile */}
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-300 hover:bg-slate-800 hover:text-white h-8 w-8 sm:w-auto sm:px-3"
              onClick={() => setShowParticipants(true)}
              title="Participantes"
              data-testid="btn-participants"
            >
              <Users className="w-4 h-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-xs font-semibold">Participantes</span>
            </Button>

            {/* Scanner — hidden on smallest screens */}
            <Link href={`/scanner/${inventoryId}`} className="hidden xs:block">
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-300 hover:bg-slate-800 hover:text-white h-8 w-8 sm:w-auto sm:px-3"
                title="Modo escáner"
                data-testid="btn-scanner-mode"
              >
                <ScanBarcode className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden md:inline text-xs font-semibold">Escáner</span>
              </Button>
            </Link>

            {/* Date — only large screens */}
            <span className="text-xs font-medium text-slate-400 hidden xl:inline-block">{today}</span>

            {/* Save */}
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSave}
              className="font-semibold h-8 text-xs"
              data-testid="btn-save"
            >
              <Save className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">
                {pendingCount > 0 ? `Guardar (${pendingCount})` : "Guardar"}
              </span>
              {pendingCount > 0 && <span className="sm:hidden ml-0.5">{pendingCount}</span>}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1400px] mx-auto w-full">

        {/* ── Summary Cards row with toggle ──────────────────────────── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-600">Resumen</span>
              {/* Quick stats badge when collapsed */}
              {!cardsVisible && (
                <span className="text-xs text-slate-400 ml-2">
                  {totalCuadrados} cuadrados · {totalFaltantes} faltantes · {totalSobrantes} sobrantes
                </span>
              )}
            </div>
            <button
              onClick={() => setCardsVisible((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 hover:bg-slate-200 rounded-md"
              title={cardsVisible ? "Ocultar tarjetas" : "Mostrar tarjetas"}
            >
              {cardsVisible ? (
                <><ChevronUp className="w-4 h-4" /> Ocultar</>
              ) : (
                <><ChevronDown className="w-4 h-4" /> Mostrar</>
              )}
            </button>
          </div>

          {cardsVisible && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="border-slate-200 shadow-sm" data-testid="card-summary-total">
                <CardHeader className="pb-1 pt-3 px-3 sm:pt-4 sm:px-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ítems</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">{items.length}</div>
                  <div className="text-xs text-slate-400 mt-1 font-medium truncate">{fmt(valorTotal)}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm border-b-4 border-b-emerald-400" data-testid="card-summary-cuadrados">
                <CardHeader className="pb-1 pt-3 px-3 sm:pt-4 sm:px-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuadrados</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">{totalCuadrados}</div>
                  <div className="text-xs text-emerald-600 mt-1 font-medium truncate">{fmt(valorCuadrados)}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm border-b-4 border-b-amber-400" data-testid="card-summary-sobrantes">
                <CardHeader className="pb-1 pt-3 px-3 sm:pt-4 sm:px-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sobrantes</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">{totalSobrantes}</div>
                  <div className="text-xs text-amber-600 mt-1 font-medium truncate">+{fmt(valorSobrantes)}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm border-b-4 border-b-rose-400" data-testid="card-summary-faltantes">
                <CardHeader className="pb-1 pt-3 px-3 sm:pt-4 sm:px-4">
                  <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faltantes</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">{totalFaltantes}</div>
                  <div className="text-xs text-rose-600 mt-1 font-medium truncate">-{fmt(valorFaltantes)}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* ── Tabs & Table ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 sm:p-4">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base sm:text-xl font-bold text-slate-900">Listado de Artículos</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={pdfLoading || items.length === 0}
                  className="text-rose-700 border-rose-200 hover:bg-rose-50 hover:border-rose-300 h-8 text-xs"
                  data-testid="btn-export-pdf"
                >
                  {pdfLoading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Reporte PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={excelLoading || items.length === 0}
                  className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 h-8 text-xs"
                  data-testid="btn-export-excel"
                >
                  {excelLoading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Exportar Excel
                </Button>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Buscar SKU o descripción..."
                className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-slate-900 text-sm h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>

          <Tabs defaultValue="pendientes" className="w-full">
            <div className="overflow-x-auto">
              <TabsList className="grid grid-cols-5 mb-4 bg-slate-100 p-1 min-w-[480px]">
                <TabsTrigger value="pendientes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs" data-testid="tab-pendientes">
                  Pendientes <Badge variant="secondary" className="ml-1 bg-slate-200 text-slate-700 text-xs px-1.5">{pendientes.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="cuadrados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs" data-testid="tab-cuadrados">
                  Cuadrados <Badge variant="secondary" className="ml-1 bg-emerald-100 text-emerald-700 text-xs px-1.5">{cuadrados.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="sobrantes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs" data-testid="tab-sobrantes">
                  Sobrantes <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5">{sobrantes.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="faltantes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs" data-testid="tab-faltantes">
                  Faltantes <Badge variant="secondary" className="ml-1 bg-rose-100 text-rose-700 text-xs px-1.5">{faltantes.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="volteados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs" data-testid="tab-volteados">
                  <ArrowLeftRight className="w-3 h-3 mr-1 shrink-0" />
                  Volteados
                  {swappedGroups.length > 0 && (
                    <Badge className="ml-1 bg-violet-100 text-violet-700 hover:bg-violet-100 text-xs px-1.5">{swappedGroups.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="pendientes" className="m-0 focus-visible:outline-none">
              {renderTable(pendientes)}
            </TabsContent>
            <TabsContent value="cuadrados" className="m-0 focus-visible:outline-none">
              {renderTable(cuadrados)}
            </TabsContent>
            <TabsContent value="sobrantes" className="m-0 focus-visible:outline-none">
              {renderTable(sobrantes)}
            </TabsContent>
            <TabsContent value="faltantes" className="m-0 focus-visible:outline-none">
              {renderTable(faltantes)}
            </TabsContent>
            <TabsContent value="volteados" className="m-0 focus-visible:outline-none">
              <SwappedCodesView groups={swappedGroups} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

// ─── Swapped Codes View ───────────────────────────────────────────────────────

function SwappedCodesView({ groups }: { groups: DiscrepancyGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
          <ArrowLeftRight className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-slate-700 font-semibold">No se detectaron posibles códigos volteados</p>
        <p className="text-slate-400 text-sm mt-1 max-w-md">
          Aparecen aquí cuando el sobrante de un artículo coincide con el faltante de otro en la misma cantidad.
        </p>
      </div>
    );
  }

  const totalItems = groups.reduce((s, g) => s + g.surplus.length + g.deficit.length, 0);

  return (
    <div className="space-y-5">
      {/* Header alert */}
      <div className="flex items-start gap-3 p-3 sm:p-4 bg-violet-50 border border-violet-200 rounded-lg">
        <ArrowLeftRight className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-violet-900">
            {groups.length} grupo{groups.length !== 1 ? "s" : ""} de posibles códigos volteados — {totalItems} artículo{totalItems !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-violet-700 mt-0.5">
            Artículos agrupados por su diferencia exacta. Los sobrantes y faltantes con el mismo valor pueden indicar que se escaneó el código incorrecto.
          </p>
        </div>
      </div>

      {/* One table per discrepancy group */}
      {groups.map((group) => (
        <div key={group.diff} className="border border-slate-200 rounded-lg overflow-hidden">
          {/* Group header */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-50 border-b border-violet-100">
            <span className="text-sm font-bold text-violet-700">
              Diferencia: {group.diff} unidad{group.diff !== 1 ? "es" : ""}
            </span>
            <span className="text-xs text-violet-500">
              {group.surplus.length} sobrante{group.surplus.length !== 1 ? "s" : ""} · {group.deficit.length} faltante{group.deficit.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[520px]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-8 pl-4"></TableHead>
                  <TableHead className="font-semibold text-slate-700 whitespace-nowrap">SKU</TableHead>
                  <TableHead className="font-semibold text-slate-700">Descripción</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700 whitespace-nowrap hidden sm:table-cell">Teórico</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700 whitespace-nowrap">Físico</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700 whitespace-nowrap">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Surplus rows */}
                {group.surplus.map(({ item, qty }) => (
                  <TableRow key={`s-${item.id}`} className="bg-amber-50/40 hover:bg-amber-50">
                    <TableCell className="pl-4">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">S</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">{item.sku}</TableCell>
                    <TableCell className="font-medium text-slate-800">{item.descripcion}</TableCell>
                    <TableCell className="text-right font-mono text-slate-500 whitespace-nowrap hidden sm:table-cell">{item.cantidadTeorica}</TableCell>
                    <TableCell className="text-right font-mono text-slate-700 whitespace-nowrap">{item.cantidadFisica}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="font-mono font-semibold text-amber-600">+{qty}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Divider row if both groups exist */}
                {group.surplus.length > 0 && group.deficit.length > 0 && (
                  <TableRow className="border-t-2 border-dashed border-slate-200">
                    <TableCell colSpan={6} className="py-0.5 bg-slate-50" />
                  </TableRow>
                )}
                {/* Deficit rows */}
                {group.deficit.map(({ item, qty }) => (
                  <TableRow key={`d-${item.id}`} className="bg-rose-50/40 hover:bg-rose-50">
                    <TableCell className="pl-4">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">F</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">{item.sku}</TableCell>
                    <TableCell className="font-medium text-slate-800">{item.descripcion}</TableCell>
                    <TableCell className="text-right font-mono text-slate-500 whitespace-nowrap hidden sm:table-cell">{item.cantidadTeorica}</TableCell>
                    <TableCell className="text-right font-mono text-slate-700 whitespace-nowrap">{item.cantidadFisica}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="font-mono font-semibold text-rose-600">-{qty}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Group footer with legend */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[9px]">S</span>
              Sobrante
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[9px]">F</span>
              Faltante
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
