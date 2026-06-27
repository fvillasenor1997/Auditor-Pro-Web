import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Plus, FolderOpen, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useInventory } from "@/context/InventoryContext";

export default function Home() {
  const [, setLocation] = useLocation();
  const { setActiveInventoryName, resetInventory } = useInventory();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);

  const [newInvName, setNewInvName] = useState("");
  const [newInvLocation, setNewInvLocation] = useState("");
  const [newInvDate, setNewInvDate] = useState("");

  const handleCreate = () => {
    if (newInvName) {
      setActiveInventoryName(`${newInvName} - ${newInvLocation}`);
    }
    resetInventory();
    setIsCreateModalOpen(false);
    setLocation("/dashboard");
  };

  const handleOpen = (name: string) => {
    setActiveInventoryName(name);
    resetInventory();
    setIsOpenModalOpen(false);
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight" data-testid="text-app-title">Auditor Pro</h1>
        <p className="mt-3 text-slate-600 font-medium">Sistema Profesional de Auditoría de Inventarios</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl px-6">
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
              <Label>Archivo Maestro</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-md p-8 text-center bg-slate-50">
                <UploadCloud className="w-8 h-8 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700">Subir archivo Excel (.xlsx)</p>
                <p className="text-xs text-slate-500 mt-1">Arrastre y suelte o haga clic para buscar</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} data-testid="btn-cancel-create">Cancelar</Button>
            <Button onClick={handleCreate} data-testid="btn-submit-create">Crear Inventario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpenModalOpen} onOpenChange={setIsOpenModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="modal-open">
          <DialogHeader>
            <DialogTitle>Abrir Inventario</DialogTitle>
            <DialogDescription>
              Seleccione una sesión de auditoría reciente para continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {[
              { name: "Inventario Mayo 2025 - Almacén Central", date: "2025-05-01", progress: 45 },
              { name: "Auditoría Sorpresa - Sector B", date: "2025-04-15", progress: 100 },
              { name: "Cierre Trimestral Q1", date: "2025-03-31", progress: 100 },
            ].map((inv, idx) => (
              <div 
                key={idx} 
                className="flex items-center justify-between p-3 border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => handleOpen(inv.name)}
                data-testid={`row-inv-recent-${idx}`}
              >
                <div>
                  <h4 className="font-semibold text-sm text-slate-900">{inv.name}</h4>
                  <p className="text-xs text-slate-500">{inv.date}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                    {inv.progress}% completado
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
