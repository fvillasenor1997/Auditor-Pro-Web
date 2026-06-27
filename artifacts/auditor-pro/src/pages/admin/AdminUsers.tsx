import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Users,
  Shield,
  User,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/auth";

interface UserRow {
  id: number;
  username: string;
  role: "admin" | "auditor";
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL as string;

async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch(`${BASE}api/auth/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Error al cargar usuarios");
  return res.json() as Promise<UserRow[]>;
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "auditor">("auditor");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  // Load users once
  useState(() => {
    fetchUsers()
      .then(setUsers)
      .catch(() => toast({ title: "Error al cargar usuarios", variant: "destructive" }))
      .finally(() => setLoading(false));
  });

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return;
    setCreating(true);
    try {
      const res = await fetch(`${BASE}api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Error al crear usuario");
      }
      const created = await res.json() as UserRow;
      setUsers((prev) => [...prev, created]);
      setIsCreateOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("auditor");
      toast({ title: "Usuario creado", description: `@${created.username} (${created.role})` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`¿Eliminar al usuario @${user.username}?`)) return;
    try {
      const res = await fetch(`${BASE}api/auth/users/${user.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Error al eliminar");
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast({ title: "Usuario eliminado" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-1.5 hover:bg-slate-100 rounded-md transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Gestión de Usuarios
            </h1>
            <p className="text-xs text-slate-500">Crea y administra cuentas de auditores</p>
          </div>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-new-user">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Usuario
        </Button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay usuarios registrados</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between shadow-sm" data-testid={`user-row-${u.id}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${u.role === "admin" ? "bg-purple-100" : "bg-emerald-100"}`}>
                    {u.role === "admin" ? (
                      <Shield className="w-4 h-4 text-purple-600" />
                    ) : (
                      <User className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">@{u.username}</p>
                    <p className="text-xs text-slate-400">
                      Creado {new Date(u.createdAt).toLocaleDateString("es")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={u.role === "admin" ? "border-purple-300 text-purple-700 bg-purple-50" : "border-emerald-300 text-emerald-700 bg-emerald-50"}>
                    {u.role === "admin" ? "Administrador" : "Auditor"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 p-0"
                    onClick={() => handleDelete(u)}
                    data-testid={`btn-delete-user-${u.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="nombre.apellido"
                autoFocus
                data-testid="input-new-username"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mín. 6 caracteres"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <div className="flex gap-2">
                {(["auditor", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      newRole === r
                        ? r === "admin"
                          ? "bg-purple-600 text-white border-purple-600"
                          : "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                    }`}
                    data-testid={`btn-role-${r}`}
                  >
                    {r === "admin" ? "Administrador" : "Auditor"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!newUsername || !newPassword || creating}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="btn-create-user"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
