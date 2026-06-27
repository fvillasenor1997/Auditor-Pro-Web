import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Save, Minus, Plus, Search, Loader2, AlertCircle } from "lucide-react";
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
import { useGetInventory, useUpdateInventoryItem, getGetInventoryQueryKey } from "@workspace/api-client-react";
import type { InventoryItem } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type ItemStatus = "Pendiente" | "Cuadrado" | "Sobrante" | "Faltante";

const getItemStatus = (item: InventoryItem): ItemStatus => {
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

export default function Dashboard() {
  const params = useParams<{ id: string }>();
  const inventoryId = parseInt(params.id ?? "", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inventory, isLoading, isError } = useGetInventory(inventoryId, {
    query: { enabled: !isNaN(inventoryId), queryKey: getGetInventoryQueryKey(inventoryId) },
  });

  const updateItem = useUpdateInventoryItem();

  // Local items state for instant UI feedback
  const [localItems, setLocalItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    if (inventory?.items) {
      setLocalItems(inventory.items);
    }
  }, [inventory?.items]);

  const [search, setSearch] = useState("");
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  const filteredItems = useMemo(() => {
    if (!search) return localItems;
    const lower = search.toLowerCase();
    return localItems.filter(
      (item) =>
        item.sku.toLowerCase().includes(lower) ||
        item.descripcion.toLowerCase().includes(lower)
    );
  }, [localItems, search]);

  const pendientes = filteredItems.filter((i) => getItemStatus(i) === "Pendiente");
  const cuadrados = filteredItems.filter((i) => getItemStatus(i) === "Cuadrado");
  const sobrantes = filteredItems.filter((i) => getItemStatus(i) === "Sobrante");
  const faltantes = filteredItems.filter((i) => getItemStatus(i) === "Faltante");

  const totalCuadrados = localItems.filter((i) => getItemStatus(i) === "Cuadrado").length;
  const totalSobrantes = localItems.filter((i) => getItemStatus(i) === "Sobrante").length;
  const totalFaltantes = localItems.filter((i) => getItemStatus(i) === "Faltante").length;

  const handleUpdateCount = (item: InventoryItem, delta: number) => {
    const newCount = Math.max(0, item.cantidadFisica + delta);

    // Optimistic UI update
    setLocalItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, cantidadFisica: newCount } : i))
    );

    setSavingIds((prev) => new Set(prev).add(item.id));

    updateItem.mutate(
      { inventoryId, itemId: item.id, data: { cantidadFisica: newCount } },
      {
        onSuccess: () => {
          setSavingIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        },
        onError: () => {
          // Revert optimistic update on error
          setLocalItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, cantidadFisica: item.cantidadFisica } : i))
          );
          setSavingIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          toast({ title: "Error al guardar", description: "No se pudo actualizar el conteo.", variant: "destructive" });
        },
      }
    );
  };

  const handleSave = () => {
    queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey(inventoryId) });
    toast({
      title: "Progreso guardado",
      description: "Los datos del inventario se han guardado correctamente.",
    });
  };

  const today = new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date());

  if (isNaN(inventoryId)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">ID de inventario inválido.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  if (isError || !inventory) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-700 font-semibold">No se encontró el inventario</p>
          <Link href="/" className="mt-4 inline-block text-sm text-slate-500 underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const renderTable = (data: InventoryItem[]) => (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow className="hover:bg-slate-50">
            <TableHead className="w-[120px] font-semibold text-slate-900">SKU</TableHead>
            <TableHead className="font-semibold text-slate-900">Descripción</TableHead>
            <TableHead className="w-[150px] font-semibold text-slate-900">Categoría</TableHead>
            <TableHead className="w-[100px] text-right font-semibold text-slate-900">Teórico</TableHead>
            <TableHead className="w-[180px] text-center font-semibold text-slate-900">Físico</TableHead>
            <TableHead className="w-[120px] text-center font-semibold text-slate-900">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                No hay registros en esta vista.
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                <TableCell className="font-medium font-mono text-xs">{item.sku}</TableCell>
                <TableCell className="text-slate-700 font-medium">{item.descripcion}</TableCell>
                <TableCell className="text-slate-500">{item.categoria}</TableCell>
                <TableCell className="text-right text-slate-500 font-mono">{item.cantidadTeorica}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      onClick={() => handleUpdateCount(item, -1)}
                      disabled={item.cantidadFisica === 0 || savingIds.has(item.id)}
                      data-testid={`btn-minus-${item.id}`}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <div className="w-16 text-center font-mono font-semibold text-lg text-slate-900 relative">
                      {savingIds.has(item.id) ? (
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
                      disabled={savingIds.has(item.id)}
                      data-testid={`btn-plus-${item.id}`}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <StatusBadge status={getItemStatus(item)} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-10 shadow-md">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-slate-800 rounded-md transition-colors" data-testid="link-back">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-slate-700 hidden sm:block" />
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">Auditor Pro</h1>
              <p className="text-xs text-slate-400 font-medium">
                {inventory.name} — {inventory.location}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-300 hidden md:inline-block">{today}</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSave}
              className="font-semibold"
              data-testid="btn-save"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-200 shadow-sm" data-testid="card-summary-total">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ítems</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-slate-900">{localItems.length}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm border-b-4 border-b-emerald-400" data-testid="card-summary-cuadrados">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuadrados</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-slate-900">{totalCuadrados}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm border-b-4 border-b-amber-400" data-testid="card-summary-sobrantes">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sobrantes</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-slate-900">{totalSobrantes}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm border-b-4 border-b-rose-400" data-testid="card-summary-faltantes">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Faltantes</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-3xl font-bold text-slate-900">{totalFaltantes}</div>
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
            <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-100 p-1">
              <TabsTrigger value="pendientes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium" data-testid="tab-pendientes">
                Pendientes <Badge variant="secondary" className="ml-2 bg-slate-200 text-slate-700">{pendientes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="cuadrados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium" data-testid="tab-cuadrados">
                Cuadrados <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700">{cuadrados.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="sobrantes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium" data-testid="tab-sobrantes">
                Sobrantes <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">{sobrantes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="faltantes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium" data-testid="tab-faltantes">
                Faltantes <Badge variant="secondary" className="ml-2 bg-rose-100 text-rose-700">{faltantes.length}</Badge>
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
          </Tabs>
        </div>
      </main>
    </div>
  );
}
