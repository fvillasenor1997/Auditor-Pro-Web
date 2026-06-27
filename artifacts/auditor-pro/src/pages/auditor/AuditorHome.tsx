import { useLocation } from "wouter";
import { ScanBarcode, FolderOpen, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListInventories, getListInventoriesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AuditorHome() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { data: inventories, isLoading } = useListInventories({
    query: { queryKey: getListInventoriesQueryKey() },
  });

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <ScanBarcode className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-bold text-white">Auditor Pro</h1>
            <p className="text-xs text-slate-500">Bienvenido, <span className="text-emerald-400">@{user?.username}</span></p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white hover:bg-slate-800"
          onClick={handleLogout}
          data-testid="btn-logout"
        >
          <LogOut className="w-4 h-4 mr-2" /> Salir
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-emerald-400" /> Inventarios Activos
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
          </div>
        ) : !inventories || inventories.length === 0 ? (
          <div className="text-center py-16 text-slate-600">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay inventarios disponibles</p>
            <p className="text-sm mt-1">Pide al administrador que cree uno.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inventories.map((inv) => (
              <button
                key={inv.id}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-700 rounded-xl px-5 py-4 text-left transition-colors group"
                onClick={() => setLocation(`/auditor/conteo/${inv.id}`)}
                data-testid={`inventory-card-${inv.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white group-hover:text-emerald-300 transition-colors">{inv.name}</p>
                    <p className="text-sm text-slate-500">{inv.location} · {inv.date}</p>
                  </div>
                  <ScanBarcode className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
