import { useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import {
  Plus,
  FolderOpen,
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  Users,
  LogOut,
  ScanBarcode,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useListInventories, getListInventoriesQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL;

interface InventoryRow {
  id: number;
  name: string;
  location: string;
  date: string;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [newInvName, setNewInvName] = useState("");
  const [newInvLocation, setNewInvLocation] = useState("");
  const [newInvDate, setNewInvDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: inventories, isLoading: inventoriesLoading, refetch } = useListInventories({
    query: { enabled: isOpenModalOpen, queryKey: getListInventoriesQueryKey() },
  });

  const handleFileSelect = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Archivo no válido", description: "Solo se aceptan archivos .xlsx o .xls", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
  };

  const handleCreate = async () => {
    if (!newInvName || !newInvLocation || !newInvDate) {
      toast({ title: "Campos requeridos", description: "Complete el nombre, ubicación y fecha.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", newInvName);
      formData.append("location", newInvLocation);
      formData.append("date", newInvDate);
      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      const token = localStorage.getItem("auditor_pro_token");
      const res = await fetch(`${BASE}api/inventories/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error ?? "Error al crear inventario");
      }

      const inventory = await res.json();
      setIsCreateModalOpen(false);
      setNewInvName("");
      setNewInvLocation("");
      setNewInvDate("");
      setSelectedFile(null);
      setLocation(`/admin/inventory/${inventory.id}`);
    } catch (err) {
      toast({
        title: "Error al crear inventario",
        description: err instanceof Error ? err.message : "Intente nuevamente",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpen = (id: number) => {
    setIsOpenModalOpen(false);
    setLocation(`/admin/inventory/${id}`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BASE}api/inventories/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Error al eliminar");
      toast({
        title: "Inventario eliminado",
        description: `"${deleteTarget.name}" y todos sus registros han sido eliminados.`,
      });
      setDeleteTarget(null);
      refetch();
    } catch {
      toast({
        title: "Error",
        description: "No se pudo eliminar el inventario. Intente nuevamente.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50">

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              Eliminar Inventario
            </DialogTitle>
            <DialogDescription className="pt-1">
              ¿Está seguro de que desea eliminar permanentemente{" "}
              <span className="font-semibold text-slate-900">"{deleteTarget?.name}"</span>?
              <br /><br />
              <span className="text-rose-600 font-medium">
                Esta acción no se puede deshacer. Se eliminarán todos los artículos,
                registros de conteo, locaciones y datos asociados de todos los auditores.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Eliminando...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" />Sí, eliminar todo</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-slate-900 flex items-center justify-center">
            <ScanBarcode className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">Auditor Pro</span>
          <span className="text-xs text-slate-400 ml-2 hidden sm:inline">Admin: @{user?.username}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/users">
            <Button variant="outline" size="sm" className="text-slate-600 border-slate-300 hover:bg-slate-50" data-testid="btn-users">
              <Users className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Usuarios</span>
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700" onClick={handleLogout} data-testid="btn-logout">
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight" data-testid="text-app-title">
            Auditor Pro
          </h1>
          <p className="mt-3 text-slate-600 font-medium text-sm sm:text-base">
            Sistema Profesional de Auditoría de Inventarios
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          <Card
            className="cursor-pointer hover-elevate transition-all border-slate-200 shadow-sm hover:shadow-md"
            onClick={() => setIsCreateModalOpen(true)}
            data-testid="card-create-inventory"
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-slate-900 text-white p-4 rounded-full mb-4">
                <Plus className="w-8 h-8" />
              </div>
              <CardTitle className="text-xl">Crear Nuevo Inventario</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-500">
                Iniciar una nueva auditoría desde un archivo maestro.
              </CardDescription>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover-elevate transition-all border-slate-200 shadow-sm hover:shadow-md"
            onClick={() => setIsOpenModalOpen(true)}
            data-testid="card-open-inventory"
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-slate-100 text-slate-900 p-4 rounded-full mb-4">
                <FolderOpen className="w-8 h-8" />
              </div>
              <CardTitle className="text-xl">Abrir Inventario</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <CardDescription className="text-slate-500">
                Continuar con una auditoría en progreso o revisar históricas.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Create Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-[500px]" data-testid="modal-create">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Inventario</DialogTitle>
              <DialogDescription>
                Configure los detalles de la nueva sesión de auditoría.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre del Inventario</Label>
                <Input
                  id="name"
                  placeholder="Ej. Inventario Mayo 2025"
                  value={newInvName}
                  onChange={(e) => setNewInvName(e.target.value)}
                  data-testid="input-inv-name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Ubicación / Almacén</Label>
                <Input
                  id="location"
                  placeholder="Ej. Almacén Central"
                  value={newInvLocation}
                  onChange={(e) => setNewInvLocation(e.target.value)}
                  data-testid="input-inv-location"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={newInvDate}
                  onChange={(e) => setNewInvDate(e.target.value)}
                  data-testid="input-inv-date"
                />
              </div>

              <div className="grid gap-2 mt-2">
                <Label>Archivo Maestro (opcional)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                  data-testid="input-file"
                />
                <div
                  className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-slate-500 bg-slate-100"
                      : selectedFile
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-300 bg-slate-50 hover:border-slate-400"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileSelect(f);
                  }}
                  data-testid="dropzone-file"
                >
                  {selectedFile ? (
                    <>
                      <FileSpreadsheet className="w-8 h-8 mx-auto text-emerald-600 mb-3" />
                      <p className="text-sm font-semibold text-emerald-700">{selectedFile.name}</p>
                      <p className="text-xs text-emerald-600 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB — Haga clic para cambiar
                      </p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-8 h-8 mx-auto text-slate-400 mb-3" />
                      <p className="text-sm font-medium text-slate-700">Subir archivo Excel (.xlsx)</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Arrastre y suelte o haga clic para buscar
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        Columnas requeridas: SKU, Descripcion, Categoria, Teorico
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isUploading}
                data-testid="btn-cancel-create"
              >
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={isUploading} data-testid="btn-submit-create">
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creando...</>
                ) : (
                  "Crear Inventario"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Open Modal */}
        <Dialog open={isOpenModalOpen} onOpenChange={setIsOpenModalOpen}>
          <DialogContent className="sm:max-w-[500px]" data-testid="modal-open">
            <DialogHeader>
              <DialogTitle>Abrir Inventario</DialogTitle>
              <DialogDescription>
                Seleccione una sesión de auditoría para continuar o eliminar.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4 max-h-[60vh] overflow-auto pr-1">
              {inventoriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : !inventories || inventories.length === 0 ? (
                <p className="text-center text-slate-500 py-8 text-sm">
                  No hay inventarios guardados. Cree uno nuevo.
                </p>
              ) : (
                [...inventories].reverse().map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors group"
                    data-testid={`row-inv-recent-${inv.id}`}
                  >
                    <button
                      className="flex-1 text-left"
                      onClick={() => handleOpen(inv.id)}
                    >
                      <h4 className="font-semibold text-sm text-slate-900">{inv.name}</h4>
                      <p className="text-xs text-slate-500">{inv.location} — {inv.date}</p>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(inv as InventoryRow);
                      }}
                      className="ml-3 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Eliminar inventario"
                      data-testid={`btn-delete-inv-${inv.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
