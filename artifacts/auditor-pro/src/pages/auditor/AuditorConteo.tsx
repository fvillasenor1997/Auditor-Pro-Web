import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Keyboard,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  Loader2,
  User,
  MapPin,
  Lock,
  ChevronDown,
  Download,
  Pencil,
  Trash2,
  Search,
  X,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  CloudOff,
  CloudCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useInventorySync } from "@/hooks/useInventorySync";
import { usePWAStatus } from "@/hooks/usePWAStatus";
import { playBeep, playErrorBeep, vibrate } from "@/lib/audio";
import { useAuth } from "@/contexts/AuthContext";
import {
  syncCountRecord,
  deleteCountRecord,
  editCountRecord,
  flushPendingCountRecords,
} from "@/lib/sync";
import { authHeaders } from "@/lib/auth";
import type { CachedItem } from "@/lib/db";

const BASE = import.meta.env.BASE_URL;

interface LocationRow {
  id: number;
  inventoryId: number;
  name: string;
}

interface FeedEntry {
  localId: string;
  serverId?: number;
  itemId: number;
  sku: string;
  descripcion: string;
  cantidad: number;
  location: string;
  synced: boolean;
  timestamp: number;
}

interface ServerRecord {
  id: number;
  username: string;
  location: string;
  cantidad: number;
  timestamp: string;
}

const QUICK_AMOUNTS = [1, 5, 10, 25];

// ─── Sync Panel ───────────────────────────────────────────────────────────────

interface SyncPanelProps {
  inventoryId: number;
  entries: FeedEntry[];
  onClose: () => void;
  onSyncNow: () => Promise<void>;
}

function SyncPanel({ inventoryId, entries, onClose, onSyncNow }: SyncPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [serverRecords, setServerRecords] = useState<ServerRecord[] | null>(null);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"local" | "server">("local");
  const { user } = useAuth();

  const pendingEntries = entries.filter((e) => !e.synced);
  const syncedEntries = entries.filter((e) => e.synced);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await onSyncNow();
    } finally {
      setSyncing(false);
    }
  };

  const loadServerRecords = async () => {
    if (!user) return;
    setLoadingServer(true);
    setServerError(null);
    try {
      // Collect unique itemIds from session entries
      const itemIds = [...new Set(entries.map((e) => e.itemId))];
      const results: ServerRecord[] = [];
      for (const itemId of itemIds) {
        const res = await fetch(
          `${BASE}api/inventories/${inventoryId}/items/${itemId}/records`,
          { headers: authHeaders() }
        );
        if (res.ok) {
          const data: ServerRecord[] = await res.json();
          // Filter only current user's records for comparison
          results.push(...data.filter((r) => r.username === user.username));
        }
      }
      // Sort by timestamp desc
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setServerRecords(results);
    } catch {
      setServerError("No se pudo conectar con el servidor.");
    } finally {
      setLoadingServer(false);
    }
  };

  useEffect(() => {
    if (activeTab === "server") {
      loadServerRecords();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white">Estado de Sincronización</h2>
              <p className="text-xs text-slate-400">
                {syncedEntries.length} sincronizados · {pendingEntries.length} pendientes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sync action bar */}
        {pendingEntries.length > 0 && (
          <div className="px-5 py-3 bg-amber-950/50 border-b border-amber-900/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm text-amber-300 font-medium">
                {pendingEntries.length} registro{pendingEntries.length !== 1 ? "s" : ""} sin enviar
              </span>
            </div>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0 h-8 text-xs"
              onClick={handleSyncNow}
              disabled={syncing || !navigator.onLine}
            >
              {syncing ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Sincronizando...</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Sincronizar ahora</>
              )}
            </Button>
          </div>
        )}

        {pendingEntries.length === 0 && entries.length > 0 && (
          <div className="px-5 py-3 bg-emerald-950/40 border-b border-emerald-900/30 flex items-center gap-2">
            <CloudCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm text-emerald-300 font-medium">Todos los registros están sincronizados</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab("local")}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "local"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Esta sesión ({entries.length})
          </button>
          <button
            onClick={() => setActiveTab("server")}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "server"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            En el servidor
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === "local" && (
            <div className="p-3 space-y-2">
              {entries.length === 0 && (
                <p className="text-center text-slate-600 text-sm py-8">
                  No hay conteos en esta sesión todavía.
                </p>
              )}
              {pendingEntries.length > 0 && (
                <>
                  <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider px-1 pb-1">Pendientes de envío</p>
                  {pendingEntries.map((e) => (
                    <SyncEntryRow key={e.localId} entry={e} />
                  ))}
                </>
              )}
              {syncedEntries.length > 0 && (
                <>
                  <p className="text-xs text-emerald-400/70 font-semibold uppercase tracking-wider px-1 pt-2 pb-1">Ya enviados al servidor</p>
                  {syncedEntries.map((e) => (
                    <SyncEntryRow key={e.localId} entry={e} />
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === "server" && (
            <div className="p-3">
              {loadingServer && (
                <div className="flex items-center justify-center py-10 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  <span className="text-slate-400 text-sm">Consultando servidor...</span>
                </div>
              )}
              {serverError && (
                <div className="flex items-center justify-center py-10 gap-2 text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{serverError}</span>
                </div>
              )}
              {!loadingServer && !serverError && serverRecords !== null && serverRecords.length === 0 && (
                <p className="text-center text-slate-600 text-sm py-10">
                  No hay registros en el servidor para tu usuario en este inventario.
                </p>
              )}
              {!loadingServer && serverRecords !== null && serverRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1 pb-1">
                    <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                      {serverRecords.length} registro{serverRecords.length !== 1 ? "s" : ""} confirmados
                    </p>
                    <button
                      onClick={loadServerRecords}
                      className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Actualizar
                    </button>
                  </div>
                  {serverRecords.map((r) => (
                    <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="text-xs text-slate-400 truncate">{r.location}</span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-emerald-400 shrink-0">+{r.cantidad}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-slate-600">ID #{r.id}</span>
                        <span className="text-xs text-slate-600">
                          {new Date(r.timestamp).toLocaleString("es-ES", {
                            day: "2-digit", month: "short",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-600">
            {navigator.onLine ? "Conectado al servidor" : "Sin conexión — offline"}
          </span>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncEntryRow({ entry }: { entry: FeedEntry }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 border ${entry.synced ? "bg-slate-800/60 border-slate-800" : "bg-amber-950/30 border-amber-900/40"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-slate-400">{entry.sku}</p>
          <p className="text-xs text-slate-300 truncate">{entry.descripcion}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0" /> {entry.location}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-mono font-bold text-emerald-400 text-base">+{entry.cantidad}</span>
          {entry.synced ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400/70">
              <CheckCircle2 className="w-3 h-3" /> Sync
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400/80">
              <Clock className="w-3 h-3" /> Pendiente
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 text-xs text-slate-600">
        {new Date(entry.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AuditorConteo() {
  const params = useParams<{ id: string }>();
  const inventoryId = parseInt(params.id ?? "", 10);
  const { user } = useAuth();
  const pwaStatus = usePWAStatus();

  const { items, status, updateCount } = useInventorySync(inventoryId);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  useEffect(() => {
    if (isNaN(inventoryId)) return;
    fetch(`${BASE}api/inventories/${inventoryId}/locations`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: LocationRow[]) => setLocations(data))
      .catch(() => setLocations([]))
      .finally(() => setLocationsLoading(false));
  }, [inventoryId]);

  const [location, setLocation] = useState("");
  const [locationLocked, setLocationLocked] = useState(false);
  const [activeItem, setActiveItem] = useState<CachedItem | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [allEntries, setAllEntries] = useState<FeedEntry[]>([]);
  const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(true);
  const [feedSearch, setFeedSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  const textInputRef = useRef<HTMLInputElement>(null);

  const isLocationReady = locationLocked && location.trim().length > 0;
  const hasLocations = locations.length > 0;
  const pendingCount = allEntries.filter((e) => !e.synced).length;

  useEffect(() => {
    const refocus = () => {
      if (textInputRef.current && !cameraOpen && isLocationReady) {
        textInputRef.current.focus();
      }
    };
    const interval = setInterval(refocus, 2000);
    refocus();
    return () => clearInterval(interval);
  }, [cameraOpen, isLocationReady]);

  const findItem = useCallback(
    (code: string): CachedItem | null => {
      const normalized = code.trim().toUpperCase();
      return (
        items.find(
          (i) =>
            i.sku.toUpperCase() === normalized ||
            i.descripcion.toUpperCase().includes(normalized)
        ) ?? null
      );
    },
    [items]
  );

  const applyCount = useCallback(
    async (item: CachedItem, amount: number) => {
      const entryLocalId = `${item.id}-${Date.now()}-${Math.random()}`;

      const newEntry: FeedEntry = {
        localId: entryLocalId,
        itemId: item.id,
        sku: item.sku,
        descripcion: item.descripcion,
        cantidad: amount,
        location: location.trim(),
        synced: false,
        timestamp: Date.now(),
      };

      setAllEntries((prev) => [newEntry, ...prev]);
      setFlashColor("green");
      setTimeout(() => setFlashColor(null), 400);
      playBeep();
      vibrate(80);

      await updateCount(item, amount);

      if (user) {
        const result = await syncCountRecord({
          inventoryId,
          itemId: item.id,
          username: user.username,
          location: location.trim(),
          cantidad: amount,
          timestamp: Date.now(),
        });
        setAllEntries((prev) =>
          prev.map((e) =>
            e.localId === entryLocalId
              ? { ...e, synced: result.status === "synced", serverId: result.serverId }
              : e
          )
        );
      }
    },
    [updateCount, inventoryId, location, user]
  );

  const handleScan = useCallback(
    (code: string) => {
      if (!isLocationReady) return;
      const item = findItem(code);
      if (!item) {
        playErrorBeep();
        vibrate([80, 50, 80]);
        setFlashColor("red");
        setTimeout(() => setFlashColor(null), 400);
        return;
      }
      setActiveItem(item);
      setCustomAmount("");
      if (quickMode) {
        applyCount(item, 1);
      }
    },
    [findItem, applyCount, isLocationReady, quickMode]
  );

  const { videoRef, isScanning, error: cameraError, startScanner, stopScanner } =
    useBarcodeScanner(handleScan, 1200);

  const toggleCamera = async () => {
    if (!isLocationReady) return;
    if (isScanning) {
      stopScanner();
      setCameraOpen(false);
    } else {
      setCameraOpen(true);
      await startScanner();
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = textInputRef.current;
    if (!isLocationReady || !input?.value.trim()) return;
    handleScan(input.value.trim());
    input.value = "";
  };

  const handleQuickAmount = async (amount: number) => {
    if (!activeItem || !isLocationReady) return;
    await applyCount(activeItem, amount);
  };

  const handleCustomConfirm = async () => {
    if (!activeItem || !isLocationReady) return;
    const amount = parseInt(customAmount, 10);
    if (!isNaN(amount) && amount > 0) {
      await applyCount(activeItem, amount);
      setCustomAmount("");
    }
  };

  const confirmLocation = () => {
    if (location.trim()) {
      setLocationLocked(true);
      setTimeout(() => textInputRef.current?.focus(), 50);
    }
  };

  const handleDelete = async (entry: FeedEntry) => {
    setAllEntries((prev) => prev.filter((e) => e.localId !== entry.localId));
    const item = items.find((i) => i.id === entry.itemId);
    if (item) await updateCount(item, -entry.cantidad);
    if (entry.serverId) {
      await deleteCountRecord(inventoryId, entry.itemId, entry.serverId);
    }
  };

  const startEdit = (entry: FeedEntry) => {
    setEditingId(entry.localId);
    setEditValue(String(entry.cantidad));
  };

  const confirmEdit = async (entry: FeedEntry) => {
    const newQty = parseInt(editValue, 10);
    if (isNaN(newQty) || newQty < 1) { setEditingId(null); return; }
    const diff = newQty - entry.cantidad;
    setAllEntries((prev) =>
      prev.map((e) => e.localId === entry.localId ? { ...e, cantidad: newQty } : e)
    );
    setEditingId(null);
    const item = items.find((i) => i.id === entry.itemId);
    if (item && diff !== 0) await updateCount(item, diff);
    if (entry.serverId) {
      await editCountRecord(inventoryId, entry.itemId, entry.serverId, newQty);
    }
  };

  // Manual sync: flush pending count records then mark matching entries as synced
  const handleManualSync = async () => {
    await flushPendingCountRecords();
    // After flushing we can't reliably get server IDs for all queued records,
    // but we optimistically mark them as synced if we're online
    if (navigator.onLine) {
      setAllEntries((prev) => prev.map((e) => ({ ...e, synced: true })));
    }
  };

  const displayedFeed = useMemo(() => {
    if (feedSearch.trim()) {
      const q = feedSearch.trim().toLowerCase();
      return allEntries.filter(
        (e) =>
          e.sku.toLowerCase().includes(q) ||
          e.descripcion.toLowerCase().includes(q)
      );
    }
    const byLocation = location.trim()
      ? allEntries.filter((e) => e.location === location.trim())
      : allEntries;
    return byLocation.slice(0, 5);
  }, [allEntries, feedSearch, location]);

  const isOnline = status === "online" || status === "syncing";

  return (
    <div
      className={`min-h-screen flex flex-col text-white transition-colors duration-100 ${
        flashColor === "green"
          ? "bg-emerald-900"
          : flashColor === "red"
          ? "bg-rose-900"
          : "bg-slate-950"
      }`}
    >
      {/* Sync panel */}
      {showSyncPanel && (
        <SyncPanel
          inventoryId={inventoryId}
          entries={allEntries}
          onClose={() => setShowSyncPanel(false)}
          onSyncNow={handleManualSync}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-3 h-14 bg-slate-900 border-b border-slate-800 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/auditor" className="p-1.5 hover:bg-slate-800 rounded-md transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-bold text-sm tracking-tight hidden xs:block">Conteo</span>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <User className="w-3 h-3" /> @{user?.username}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pwaStatus === "installing" && (
            <span className="flex items-center gap-1 text-xs text-amber-400" title="Descargando para offline">
              <Download className="w-3.5 h-3.5 animate-bounce" />
            </span>
          )}
          {isOnline ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">En línea</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
          {/* Manual sync button */}
          <button
            onClick={() => setShowSyncPanel(true)}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-xs font-semibold text-slate-300 hover:text-white"
            title="Estado de sincronización"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync</span>
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 rounded-full text-[10px] font-bold text-slate-950 flex items-center justify-center">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-auto">

        {/* ── Location selector ─────────────────────────────────────────── */}
        <section className="shrink-0 bg-slate-900 border-b border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Locación actual</span>
            {isLocationReady && (
              <span className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Lista
              </span>
            )}
          </div>

          {locationsLoading ? (
            <div className="flex items-center gap-2 text-slate-500 py-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Cargando locaciones...</span>
            </div>
          ) : hasLocations ? (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
                <select
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); if (locationLocked) setLocationLocked(false); }}
                  disabled={locationLocked}
                  className="w-full bg-slate-800 border border-slate-700 disabled:border-emerald-700 disabled:bg-emerald-950/40 text-white text-sm pl-9 pr-9 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none transition-colors cursor-pointer disabled:cursor-default"
                >
                  <option value="" disabled className="bg-slate-800">— Seleccione una locación —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name} className="bg-slate-800">{loc.name}</option>
                  ))}
                </select>
              </div>
              {!locationLocked ? (
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0 h-10" onClick={confirmLocation} disabled={!location.trim()}>
                  Confirmar
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 shrink-0 h-10" onClick={() => setLocationLocked(false)}>
                  Cambiar
                </Button>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); if (locationLocked) setLocationLocked(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && location.trim()) confirmLocation(); }}
                  placeholder="Ej: Pasillo A, Estante 3..."
                  disabled={locationLocked}
                  className="w-full bg-slate-800 border border-slate-700 disabled:border-emerald-700 disabled:bg-emerald-950/40 text-white text-sm pl-9 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-600 transition-colors"
                  autoComplete="off"
                />
              </div>
              {!locationLocked ? (
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shrink-0 h-10" onClick={confirmLocation} disabled={!location.trim()}>
                  Confirmar
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800 shrink-0 h-10" onClick={() => setLocationLocked(false)}>
                  Cambiar
                </Button>
              )}
            </div>
          )}

          {!isLocationReady && (
            <p className="mt-2 text-xs text-amber-400/80 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              {hasLocations ? "Selecciona y confirma una locación antes de contar" : "Introduce la locación antes de contar"}
            </p>
          )}
        </section>

        {/* ── Scanner input ─────────────────────────────────────────────── */}
        <section className={`shrink-0 bg-slate-900 border-b border-slate-800 transition-opacity ${!isLocationReady ? "opacity-40 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              {isScanning ? "Cámara activa" : "Pistola / Manual"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs"
              onClick={toggleCamera}
              disabled={!isLocationReady}
            >
              {isScanning ? (
                <><CameraOff className="w-3.5 h-3.5 mr-1.5" />Apagar</>
              ) : (
                <><Camera className="w-3.5 h-3.5 mr-1.5" />Cámara</>
              )}
            </Button>
          </div>

          {cameraOpen && (
            <div className="relative mx-4 mb-2 rounded-lg overflow-hidden bg-slate-800 aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-28 border-2 border-emerald-400 rounded-md opacity-70">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 -translate-x-0.5 -translate-y-0.5" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 translate-x-0.5 -translate-y-0.5" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 -translate-x-0.5 translate-y-0.5" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 translate-x-0.5 translate-y-0.5" />
                </div>
              </div>
              {!isScanning && cameraOpen && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                </div>
              )}
            </div>
          )}

          {cameraError && (
            <p className="mx-4 mb-2 text-xs text-amber-400 bg-amber-950/50 px-3 py-2 rounded">{cameraError}</p>
          )}

          <form onSubmit={handleManualSubmit} className="px-4 pb-4">
            <div className="relative">
              <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                ref={textInputRef}
                type="text"
                placeholder="Escanee o escriba el código / SKU..."
                className="w-full bg-slate-800 border border-slate-700 text-white text-xl font-mono pl-10 pr-4 py-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-600 placeholder:text-sm placeholder:font-sans"
                disabled={!isLocationReady}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </form>
        </section>

        {/* ── Active item + quick controls ──────────────────────────────── */}
        <section className={`shrink-0 bg-slate-950 border-b border-slate-800 px-4 py-3 transition-opacity ${!isLocationReady ? "opacity-40 pointer-events-none" : ""}`}>

          {/* +1 Quick mode toggle */}
          <button
            className="w-full flex items-center justify-between mb-3 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-600 transition-colors"
            onClick={() => setQuickMode((v) => !v)}
          >
            <div className="flex items-center gap-2">
              {quickMode ? (
                <ToggleRight className="w-5 h-5 text-emerald-400" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-slate-500" />
              )}
              <span className={`text-sm font-semibold ${quickMode ? "text-emerald-400" : "text-slate-400"}`}>
                Modo +1
              </span>
            </div>
            <span className="text-xs text-slate-500">
              {quickMode ? "Cada escaneo agrega 1" : "Elige cantidad tras escanear"}
            </span>
          </button>

          {/* Active item display */}
          {activeItem ? (
            <div className="flex items-center justify-between mb-3 bg-slate-900 rounded-lg px-4 py-3 border border-slate-700">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-400">{activeItem.sku}</p>
                <p className="font-semibold text-sm text-white truncate">{activeItem.descripcion}</p>
                <p className="text-xs text-slate-500">{activeItem.categoria}</p>
              </div>
              <div className="text-right ml-4 shrink-0">
                <div className="text-3xl font-bold font-mono text-white">{activeItem.cantidadFisica}</div>
                <div className="text-xs text-slate-600">contado</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center bg-slate-900/50 rounded-lg px-4 py-4 mb-3 border border-dashed border-slate-700">
              <p className="text-slate-600 text-sm">Escanee un código para seleccionar un artículo</p>
            </div>
          )}

          {/* Quick amount buttons */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {QUICK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                className="border-slate-700 bg-slate-900 text-white hover:bg-emerald-900 hover:border-emerald-600 active:bg-emerald-700 text-lg font-bold h-12 disabled:opacity-40"
                onClick={() => handleQuickAmount(amount)}
                disabled={!activeItem || !isLocationReady}
              >
                +{amount}
              </Button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={9999}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCustomConfirm(); }}
              placeholder="Cantidad exacta..."
              disabled={!activeItem || !isLocationReady}
              className="flex-1 bg-slate-900 border border-slate-700 text-white text-lg font-mono px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-600 placeholder:text-sm placeholder:font-sans disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 disabled:opacity-40"
              onClick={handleCustomConfirm}
              disabled={!activeItem || !customAmount || !isLocationReady}
            >
              Agregar
            </Button>
          </div>
        </section>

        {/* ── Feed ─────────────────────────────────────────────────────── */}
        <section className="flex-1 px-4 py-3 overflow-auto">
          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              placeholder="Buscar por código o descripción..."
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm pl-9 pr-9 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600 placeholder:text-slate-600"
            />
            {feedSearch && (
              <button onClick={() => setFeedSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              {feedSearch
                ? `${displayedFeed.length} resultado${displayedFeed.length !== 1 ? "s" : ""}`
                : `Últimos — ${location.trim() || "sin locación"}`}
            </p>
            {allEntries.length > 0 && !feedSearch && (
              <span className="text-xs text-slate-600">
                {allEntries.filter((e) => e.location === location.trim()).length} en esta locación
              </span>
            )}
          </div>

          {displayedFeed.length === 0 ? (
            <p className="text-center text-slate-700 text-sm py-6">
              {feedSearch ? "Sin resultados" : "Los artículos contados aquí aparecerán en esta lista"}
            </p>
          ) : (
            <div className="space-y-2">
              {displayedFeed.map((entry) => (
                <FeedRow
                  key={entry.localId}
                  entry={entry}
                  editing={editingId === entry.localId}
                  editValue={editValue}
                  onEditValueChange={setEditValue}
                  onStartEdit={() => startEdit(entry)}
                  onConfirmEdit={() => confirmEdit(entry)}
                  onDelete={() => handleDelete(entry)}
                  onCancelEdit={() => setEditingId(null)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Feed Row ────────────────────────────────────────────────────────────────

interface FeedRowProps {
  entry: FeedEntry;
  editing: boolean;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onDelete: () => void;
  onCancelEdit: () => void;
}

function FeedRow({ entry, editing, editValue, onEditValueChange, onStartEdit, onConfirmEdit, onDelete, onCancelEdit }: FeedRowProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-slate-400">{entry.sku}</p>
          <p className="text-sm font-medium text-white truncate">{entry.descripcion}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            {entry.location}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConfirmEdit();
                  if (e.key === "Escape") onCancelEdit();
                }}
                autoFocus
                className="w-14 bg-slate-800 border border-emerald-500 text-white text-center text-base font-mono rounded px-1 py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button onClick={onConfirmEdit} className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors" title="Guardar">
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button onClick={onCancelEdit} className="p-1 text-slate-500 hover:text-slate-300 transition-colors" title="Cancelar">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <span className="font-mono font-bold text-emerald-400 text-lg">+{entry.cantidad}</span>
              <button onClick={onStartEdit} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors" title="Editar">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors" title="Eliminar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-slate-600">
          {new Date(entry.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <span className="flex items-center gap-1 text-xs">
          {entry.synced ? (
            <><CheckCircle2 className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400/70">Sync</span></>
          ) : (
            <><Clock className="w-3 h-3 text-slate-600" /><span className="text-slate-600">Pendiente</span></>
          )}
        </span>
      </div>
    </div>
  );
}
