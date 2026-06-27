import type { ComponentType } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  component: ComponentType;
  role?: "admin" | "auditor";
}

export function ProtectedRoute({ component: Component, role }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (role && user?.role !== role) {
    // Redirect to the correct panel for the user's role
    return <Redirect to={user?.role === "admin" ? "/admin" : "/auditor"} />;
  }

  return <Component />;
}
