import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  Save,
  Minus,
  Plus,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Cuadrado</Badge>;
    case "Sobrante":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Sobrante</Badge>;
    case "Faltante":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200">Faltante</Badge>;
    default:
      return <Badge variant="outline" className="text-slate-500 bg-slate-50">Pendiente</Badge>;
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
        <span className="hidden sm:inline">Descargando</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium" title="Listo para trabajar sin conexión">
      <Wifi className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Offline listo</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-slate-500" />
              Detalle de Conteo
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              <span className="font-mono">{item.sku}</span> — {item.descripcion}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
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
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-900">Auditor</TableHead>
                  <TableHead className="font-semibold text-slate-900">Locación</TableHead>
                  <TableHead className="text-right font-semibold text-slate-900">Cantidad</TableHead>
                  <TableHead className="font-semibold text-slate-900">Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-slate-800">@{r.username}</TableCell>
                    <TableCell className="text-slate-600">
                      <span className="flex items-center gap-1.5">
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
          )}
        </div>

        {records !== null && records.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-xl">
            <span className="text-sm text-slate-500">{records.length} registro{records.length !== 1 ? "s" : ""}</span>
            <span className="text-sm font-semibold text-slate-900">
              Total contado:{" "}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-500" />
            Participantes
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 max-h-[60vh] overflow-auto">
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
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white text-sm font-bold">
                      {p.username[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">@{p.username}</p>
                      <p className="text-xs text-slate-500">{p.totalRecords} registro{p.totalRecords !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      Último conteo
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-500" />
            Locaciones
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-slate-100">
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

        <div className="flex-1 overflow-auto px-6 py-3">
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
                  <span className="flex items-center gap-2 text-sm text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {loc.name}
                  </span>
                  <button
                    onClick={() => handleDelete(loc.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                    title="Eliminar locación"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <p className="text-xs text-slate-400">
            {locations?.length ?? 0} locación{(locations?.length ?? 0) !== 1 ? "es" : ""} registrada{(locations?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Swapped Codes Detection ──────────────────────────────────────────────────

interface SwappedPair {
  surplus: CachedItem;
  deficit: CachedItem;
  surplusQty: number;
  deficitQty: number;
  diff: number;
}

function detectSwappedCodes(items: CachedItem[]): SwappedPair[] {
  const sobrantes = items.filter((i) => i.cantidadFisica > i.cantidadTeorica);
  const faltantes = items.filter((i) => i.cantidadFisica < i.cantidadTeorica && i.cantidadFisica > 0);
  const pairs: SwappedPair[] = [];
  const used = new Set<number>();

  for (const s of sobrantes) {
    const surplusQty = s.cantidadFisica - s.cantidadTeorica;
    for (const f of faltantes) {
      if (used.has(f.id)) continue;
      const deficitQty = f.cantidadTeorica - f.cantidadFisica;
      const diff = Math.abs(surplusQty - deficitQty);
      const tolerance = Math.max(2, Math.round(Math.max(surplusQty, deficitQty) * 0.15));
      if (diff <= tolerance) {
        pairs.push({ surplus: s, deficit: f, surplusQty, deficitQty, diff });
        used.add(f.id);
        break;
      }
    }
  }
  return pairs.sort((a, b) => a.diff - b.diff);
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const params = useParams<{ id: string }>();
  const inventoryId = parseInt(params.id ?? "", 10);
  const { toast } = useToast();

  const { items, inventory, status, pendingCount, updateCount, forceSync } =
    useInventorySync(inventoryId);

  const [search, setSearch] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [historyItem, setHistoryItem] = useState<CachedItem | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showLocations, setShowLocations] = useState(false);

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

  const swappedPairs = useMemo(() => detectSwappedCodes(items), [items]);

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

  const handleUpdateCount = async (item: CachedItem, delta: number) => {
    setUpdatingIds((prev) => new Set(prev).add(item.id));
    try {
      await updateCount(item, delta);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
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
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-slate-50">
              <TableHead className="w-[120px] font-semibold text-slate-900">SKU</TableHead>
              <TableHead className="font-semibold text-slate-900">Descripción</TableHead>
              <TableHead className="w-[130px] font-semibold text-slate-900">Categoría</TableHead>
              <TableHead className="w-[90px] text-right font-semibold text-slate-900">Precio</TableHead>
              <TableHead className="w-[90px] text-right font-semibold text-slate-900">Teórico</TableHead>
              <TableHead className="w-[180px] text-center font-semibold text-slate-900">Físico</TableHead>
              <TableHead className="w-[110px] text-center font-semibold text-slate-900">Estado</TableHead>
              <TableHead className="w-[60px] text-center font-semibold text-slate-900">Ver</TableHead>
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
                  <TableCell className="font-medium font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-slate-700 font-medium">{item.descripcion}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{item.categoria}</TableCell>
                  <TableCell className="text-right text-slate-600 font-mono text-sm">
                    {Number(item.precio ?? 0) > 0 ? `$${Number(item.precio).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-slate-500 font-mono">{item.cantidadTeorica}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() => handleUpdateCount(item, -1)}
                        disabled={item.cantidadFisica === 0 || updatingIds.has(item.id)}
                        data-testid={`btn-minus-${item.id}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="w-16 text-center font-mono font-semibold text-lg text-slate-900">
                        {updatingIds.has(item.id) ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                        ) : (
                          item.cantidadFisica
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() => handleUpdateCount(item, 1)}
                        disabled={updatingIds.has(item.id)}
                        data-testid={`btn-plus-${item.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={getItemStatus(item)} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      onClick={() => setHistoryItem(item)}
                      title="Ver historial de conteo"
                      data-testid={`btn-history-${item.id}`}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    ),
    [updatingIds, handleUpdateCount]
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
          Modo sin conexión — Los cambios se guardan localmente y se sincronizarán cuando vuelva la conexión.
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-slate-800 rounded-md transition-colors" data-testid="link-back">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-slate-700 hidden sm:block" />
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">Auditor Pro</h1>
              <p className="text-xs text-slate-400 font-medium">
                {inventoryName}{inventoryLocation ? ` — ${inventoryLocation}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SWBadge />
            <OfflineIndicator status={status} pendingCount={pendingCount} onSync={forceSync} />

            {/* Locations button */}
            <Button
              size="sm"
              variant="outline"
              className="font-semibold border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
              onClick={() => setShowLocations(true)}
              title="Gestionar locaciones"
            >
              <MapPin className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">Locaciones</span>
            </Button>

            {/* Participants button */}
            <Button
              size="sm"
              variant="outline"
              className="font-semibold border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
              onClick={() => setShowParticipants(true)}
              data-testid="btn-participants"
            >
              <Users className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">Participantes</span>
            </Button>

            <span className="text-sm font-medium text-slate-300 hidden lg:inline-block">{today}</span>
            <Link href={`/scanner/${inventoryId}`}>
              <Button
                size="sm"
                variant="outline"
                className="font-semibold border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
                data-testid="btn-scanner-mode"
              >
                <ScanBarcode className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Escáner</span>
              </Button>
            </Link>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSave}
              className="font-semibold"
              data-testid="btn-save"
            >
              <Save className="w-4 h-4 mr-2" />
              {pendingCount > 0 ? `Guardar (${pendingCount})` : "Guardar"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-200 shadow-sm" data-testid="card-summary-total">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ítems</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-slate-900">{items.length}</div>
              <div className="text-xs text-slate-400 mt-1 font-medium">{fmt(valorTotal)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm border-b-4 border-b-emerald-400" data-testid="card-summary-cuadrados">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuadrados</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-slate-900">{totalCuadrados}</div>
              <div className="text-xs text-emerald-600 mt-1 font-medium">{fmt(valorCuadrados)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm border-b-4 border-b-amber-400" data-testid="card-summary-sobrantes">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sobrantes</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-slate-900">{totalSobrantes}</div>
              <div className="text-xs text-amber-600 mt-1 font-medium">+{fmt(valorSobrantes)}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm border-b-4 border-b-rose-400" data-testid="card-summary-faltantes">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faltantes</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-slate-900">{totalFaltantes}</div>
              <div className="text-xs text-rose-600 mt-1 font-medium">-{fmt(valorFaltantes)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs & Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-slate-900">Listado de Artículos</h2>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Buscar por SKU o descripción..."
                className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-slate-900"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>

          <Tabs defaultValue="pendientes" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6 bg-slate-100 p-1">
              <TabsTrigger value="pendientes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs sm:text-sm" data-testid="tab-pendientes">
                Pendientes <Badge variant="secondary" className="ml-1 sm:ml-2 bg-slate-200 text-slate-700">{pendientes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="cuadrados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs sm:text-sm" data-testid="tab-cuadrados">
                Cuadrados <Badge variant="secondary" className="ml-1 sm:ml-2 bg-emerald-100 text-emerald-700">{cuadrados.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="sobrantes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs sm:text-sm" data-testid="tab-sobrantes">
                Sobrantes <Badge variant="secondary" className="ml-1 sm:ml-2 bg-amber-100 text-amber-700">{sobrantes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="faltantes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs sm:text-sm" data-testid="tab-faltantes">
                Faltantes <Badge variant="secondary" className="ml-1 sm:ml-2 bg-rose-100 text-rose-700">{faltantes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="volteados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs sm:text-sm" data-testid="tab-volteados">
                <ArrowLeftRight className="w-3.5 h-3.5 mr-1 shrink-0" />
                Volteados
                {swappedPairs.length > 0 && (
                  <Badge className="ml-1 sm:ml-2 bg-violet-100 text-violet-700 hover:bg-violet-100">{swappedPairs.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

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
              <SwappedCodesView pairs={swappedPairs} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

// ─── Swapped Codes View ───────────────────────────────────────────────────────

function SwappedCodesView({ pairs }: { pairs: SwappedPair[] }) {
  if (pairs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
          <ArrowLeftRight className="w-6 h-6 text-emerald-500" />
        </div>
        <p className="text-slate-700 font-semibold">No se detectaron posibles códigos volteados</p>
        <p className="text-slate-400 text-sm mt-1 max-w-md">
          Aparecen aquí cuando el sobrante de un artículo coincide con el faltante de otro, indicando posible confusión de códigos al escanear.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-3 mb-4 p-4 bg-violet-50 border border-violet-200 rounded-lg">
        <ArrowLeftRight className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-violet-900">
            {pairs.length} posible{pairs.length !== 1 ? "s" : ""} código{pairs.length !== 1 ? "s" : ""} volteado{pairs.length !== 1 ? "s" : ""} detectado{pairs.length !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-violet-700 mt-0.5">
            Cuando sobran unidades de un artículo y faltan cantidades similares de otro, es probable que el auditor haya escaneado un código incorrecto.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {pairs.map((pair, idx) => (
          <div key={idx} className="border border-violet-200 bg-violet-50/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                Par #{idx + 1}
              </span>
              {pair.diff === 0 && (
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Coincidencia exacta
                </span>
              )}
              {pair.diff > 0 && (
                <span className="text-xs text-slate-500">
                  Diferencia: {pair.diff} unidad{pair.diff !== 1 ? "es" : ""}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Sobrante</span>
                  <span className="font-mono text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                    +{pair.surplusQty}
                  </span>
                </div>
                <p className="font-mono text-xs text-slate-500 mb-0.5">{pair.surplus.sku}</p>
                <p className="text-sm font-semibold text-slate-800 leading-tight">{pair.surplus.descripcion}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Contado: {pair.surplus.cantidadFisica} / Teórico: {pair.surplus.cantidadTeorica}
                </p>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-wide">Faltante</span>
                  <span className="font-mono text-xs text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">
                    -{pair.deficitQty}
                  </span>
                </div>
                <p className="font-mono text-xs text-slate-500 mb-0.5">{pair.deficit.sku}</p>
                <p className="text-sm font-semibold text-slate-800 leading-tight">{pair.deficit.descripcion}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Contado: {pair.deficit.cantidadFisica} / Teórico: {pair.deficit.cantidadTeorica}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
