import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Scanner from "@/pages/Scanner";
import AdminUsers from "@/pages/admin/AdminUsers";
import AuditorHome from "@/pages/auditor/AuditorHome";
import AuditorConteo from "@/pages/auditor/AuditorConteo";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,
    },
  },
});

/** Redirects root `/` based on auth status and role */
function RootRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <Redirect to={user?.role === "admin" ? "/admin" : "/auditor"} />;
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/login" component={Login} />

      {/* Root: redirect based on role */}
      <Route path="/">
        <RootRedirect />
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        <ProtectedRoute component={Home} role="admin" />
      </Route>
      <Route path="/admin/inventory/:id">
        <ProtectedRoute component={Dashboard} role="admin" />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsers} role="admin" />
      </Route>

      {/* Legacy dashboard route — redirect admins to new path */}
      <Route path="/dashboard/:id">
        <ProtectedRoute component={Dashboard} role="admin" />
      </Route>
      <Route path="/scanner/:id">
        <ProtectedRoute component={Scanner} role="admin" />
      </Route>

      {/* Auditor routes */}
      <Route path="/auditor">
        <ProtectedRoute component={AuditorHome} role="auditor" />
      </Route>
      <Route path="/auditor/conteo/:id">
        <ProtectedRoute component={AuditorConteo} role="auditor" />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
