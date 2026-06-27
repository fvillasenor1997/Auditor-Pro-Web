import { useState, useRef, useCallback, useEffect } from "react";
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
  RotateCcw,
  Hash,
  Delete,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useInventorySync } from "@/hooks/useInventorySync";
import { playBeep, playErrorBeep, vibrate } from "@/lib/audio";
import type { CachedItem } from "@/lib/db";

interface ScannedEntry {
  id: string;
  sku: string;
  descripcion: string;
  newCount: number;
  synced: boolean;
  timestamp: number;
}

const QUICK_AMOUNTS = [1, 5, 10, 25];

export default function Scanner() {
  const params = useParams<{ id: string }>();
  const inventoryId = parseInt(params.id ?? "", 10);

  const { items, status, updateCount } = useInventorySync(inventoryId);

  // Current matched item + manual input
  const [activeItem, setActiveItem] = useState<CachedItem | null>(null);
  const [numpadValue, setNumpadValue] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [feed, setFeed] = useState<ScannedEntry[]>([]);
  const [flashColor, setFlashColor] = useState<"green" | "red" | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const textInputRef = useRef<HTMLInputElement>(null);

  // Keep text input focused
  useEffect(() => {
    const refocus = () => {
      if (textInputRef.current && !cameraOpen) {
        textInputRef.current.focus();
      }
    };
    const interval = setInterval(refocus, 2000);
    refocus();
    return () => clearInterval(interval);
  }, [cameraOpen]);

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
      const entry: ScannedEntry = {
        id: `${item.id}-${Date.now()}`,
        sku: item.sku,
        descripcion: item.descripcion,
        newCount: item.cantidadFisica + amount,
        synced: false,
        timestamp: Date.now(),
      };

      setFeed((prev) => [entry, ...prev].slice(0, 5));
      setFlashColor("green");
      setTimeout(() => setFlashColor(null), 400);
      playBeep();
      vibrate(80);

      await updateCount(item, amount);

      setFeed((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, synced: status === "online" } : e))
      );
    },
    [updateCount, status]
  );

  const handleScan = useCallback(
    (code: string) => {
      const item = findItem(code);
      if (!item) {
        playErrorBeep();
        vibrate([80, 50, 80]);
        setFlashColor("red");
        setTimeout(() => setFlashColor(null), 400);
        return;
      }
      setActiveItem(item);
      setNumpadValue("");
      applyCount(item, 1);
    },
    [findItem, applyCount]
  );

  const { videoRef, isScanning, error: cameraError, startScanner, stopScanner } =
    useBarcodeScanner(handleScan, 1200);

  const toggleCamera = async () => {
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
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
      setManualInput("");
    }
  };

  // Numpad logic
  const handleNumpad = (key: string) => {
    if (key === "backspace") {
      setNumpadValue((v) => v.slice(0, -1));
    } else if (key === "clear") {
      setNumpadValue("");
    } else if (numpadValue.length < 6) {
      setNumpadValue((v) => v + key);
    }
  };

  const handleQuickAmount = async (amount: number) => {
    if (!activeItem) return;
    await applyCount(activeItem, amount);
  };

  const handleNumpadConfirm = async () => {
    if (!activeItem || !numpadValue) return;
    const amount = parseInt(numpadValue, 10);
    if (!isNaN(amount) && amount > 0) {
      await applyCount(activeItem, amount);
      setNumpadValue("");
    }
  };

  const numpadKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "backspace", "clear"];

  const isOnline = status === "online" || status === "syncing";

  return (
    <div
      className={`min-h-screen flex flex-col bg-slate-950 text-white transition-colors duration-100 ${
        flashColor === "green"
          ? "bg-emerald-900"
          : flashColor === "red"
          ? "bg-rose-900"
          : "bg-slate-950"
      }`}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/${inventoryId}`}
            className="p-1.5 hover:bg-slate-800 rounded-md transition-colors"
            data-testid="link-back-scanner"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-bold text-sm tracking-tight">Modo Escáner</span>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Wifi className="w-3.5 h-3.5" /> En línea
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
          {status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-auto">
        {/* === SECTION 1: CAMERA + INPUT === */}
        <section className="shrink-0 bg-slate-900 border-b border-slate-800">
          {/* Camera toggle */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
              {isScanning ? "Cámara activa" : "Pistola / Manual"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs"
              onClick={toggleCamera}
              data-testid="btn-toggle-camera"
            >
              {isScanning ? (
                <><CameraOff className="w-3.5 h-3.5 mr-1.5" /> Apagar cámara</>
              ) : (
                <><Camera className="w-3.5 h-3.5 mr-1.5" /> Usar cámara</>
              )}
            </Button>
          </div>

          {/* Camera preview */}
          {cameraOpen && (
            <div className="relative mx-4 mb-2 rounded-lg overflow-hidden bg-slate-800 aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
                data-testid="video-scanner"
              />
              {/* Scan reticle */}
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
            <p className="mx-4 mb-2 text-xs text-amber-400 bg-amber-950/50 px-3 py-2 rounded" data-testid="text-camera-error">
              {cameraError}
            </p>
          )}

          {/* Big text input */}
          <form onSubmit={handleManualSubmit} className="px-4 pb-4">
            <div className="relative">
              <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                ref={textInputRef}
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Escanee o escriba el código de barras / SKU..."
                className="w-full bg-slate-800 border border-slate-700 text-white text-xl font-mono pl-10 pr-4 py-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-600 placeholder:text-sm placeholder:font-sans"
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-testid="input-barcode"
              />
            </div>
          </form>
        </section>

        {/* === SECTION 2: ACTIVE ITEM + CONTROLS === */}
        <section className="shrink-0 bg-slate-950 border-b border-slate-800 px-4 py-3">
          {/* Active item display */}
          {activeItem ? (
            <div className="flex items-center justify-between mb-4 bg-slate-900 rounded-lg px-4 py-3 border border-slate-700" data-testid="card-active-item">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-400">{activeItem.sku}</p>
                <p className="font-semibold text-sm text-white truncate">{activeItem.descripcion}</p>
                <p className="text-xs text-slate-500">{activeItem.categoria}</p>
              </div>
              <div className="text-right ml-4 shrink-0">
                <div className="text-3xl font-bold font-mono text-white">{activeItem.cantidadFisica}</div>
                <div className="text-xs text-slate-500">de {activeItem.cantidadTeorica}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center bg-slate-900/50 rounded-lg px-4 py-5 mb-4 border border-dashed border-slate-700" data-testid="card-no-item">
              <p className="text-slate-600 text-sm">Escanee un código para seleccionar un artículo</p>
            </div>
          )}

          {/* Quick amount buttons */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {QUICK_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant="outline"
                className="border-slate-700 bg-slate-900 text-white hover:bg-emerald-900 hover:border-emerald-600 active:bg-emerald-700 text-lg font-bold h-14 disabled:opacity-40"
                onClick={() => handleQuickAmount(amount)}
                disabled={!activeItem}
                data-testid={`btn-quick-${amount}`}
              >
                +{amount}
              </Button>
            ))}
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {numpadKeys.map((key) => (
              <Button
                key={key}
                variant="outline"
                className={`border-slate-700 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 h-12 font-bold text-base disabled:opacity-40 ${
                  key === "backspace"
                    ? "text-rose-400 hover:text-rose-300"
                    : key === "clear"
                    ? "text-amber-400 hover:text-amber-300"
                    : "text-white"
                }`}
                onClick={() => handleNumpad(key)}
                disabled={!activeItem && key !== "backspace" && key !== "clear"}
                data-testid={`btn-numpad-${key}`}
              >
                {key === "backspace" ? (
                  <Delete className="w-4 h-4" />
                ) : key === "clear" ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  key
                )}
              </Button>
            ))}
          </div>

          {/* Numpad display + confirm */}
          <div className="flex gap-2">
            <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 font-mono text-2xl font-bold text-white text-center min-h-[52px]" data-testid="display-numpad">
              {numpadValue || (
                <span className="text-slate-700 text-sm font-sans font-normal">Ingrese cantidad</span>
              )}
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold h-[52px] px-6 text-base shrink-0 disabled:opacity-40"
              onClick={handleNumpadConfirm}
              disabled={!activeItem || !numpadValue}
              data-testid="btn-confirm-count"
            >
              <Hash className="w-4 h-4 mr-1.5" />
              Agregar
            </Button>
          </div>
        </section>

        {/* === SECTION 3: SCAN FEED === */}
        <section className="flex-1 px-4 py-3 overflow-auto" data-testid="section-feed">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Últimos escaneados
            </p>
            {feed.length > 0 && (
              <button
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                onClick={() => setFeed([])}
                data-testid="btn-clear-feed"
              >
                Limpiar
              </button>
            )}
          </div>

          {feed.length === 0 ? (
            <p className="text-center text-slate-700 text-sm py-6">
              Los artículos escaneados aparecerán aquí
            </p>
          ) : (
            <div className="space-y-2">
              {feed.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-opacity ${
                    idx === 0
                      ? "bg-slate-800 border-slate-600 opacity-100"
                      : "bg-slate-900 border-slate-800 opacity-70"
                  }`}
                  data-testid={`feed-item-${idx}`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-400">{entry.sku}</p>
                    <p className="text-sm font-medium text-white truncate">{entry.descripcion}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="font-mono font-bold text-emerald-400 text-lg">
                      +{entry.newCount - (entry.newCount - (feed[idx + 1]?.newCount ?? 0))}
                      <span className="text-xs text-slate-500 ml-1">→ {entry.newCount}</span>
                    </span>
                    <div className="w-5 h-5 shrink-0" data-testid={`feed-sync-${idx}`}>
                      {entry.synced ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
