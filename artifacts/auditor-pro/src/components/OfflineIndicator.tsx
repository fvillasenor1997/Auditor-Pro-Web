import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncStatus } from "@/hooks/useInventorySync";

interface OfflineIndicatorProps {
  status: SyncStatus;
  pendingCount: number;
  onSync: () => void;
}

export function OfflineIndicator({ status, pendingCount, onSync }: OfflineIndicatorProps) {
  if (status === "online" && pendingCount === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium" data-testid="status-online">
        <Wifi className="w-3.5 h-3.5" />
        <span>En línea</span>
      </div>
    );
  }

  if (status === "syncing") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-sky-400 font-medium" data-testid="status-syncing">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Sincronizando{pendingCount > 0 ? ` (${pendingCount})` : ""}...</span>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className="flex items-center gap-2" data-testid="status-offline">
        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Sin conexión{pendingCount > 0 ? ` · ${pendingCount} pendientes` : ""}</span>
        </div>
        {pendingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-amber-300 hover:text-amber-100 hover:bg-slate-700"
            onClick={onSync}
            data-testid="btn-force-sync"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reintentar
          </Button>
        )}
      </div>
    );
  }

  if (status === "online" && pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-sky-400 font-medium" data-testid="status-pending">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>{pendingCount} cambios por sincronizar</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-rose-400 font-medium" data-testid="status-error">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Sin datos — verifique conexión</span>
      </div>
    );
  }

  return null;
}
