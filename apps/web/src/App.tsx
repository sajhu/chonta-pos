import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.js";
import { OfflineBanner } from "./components/OfflineBanner.js";
import { NavBar } from "./components/NavBar.js";
import { RoleRoute } from "./components/RoleRoute.js";
import { Login } from "./pages/Login.js";
import { Pos } from "./pages/Pos.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Caja } from "./pages/Caja.js";
import { Historico } from "./pages/Historico.js";
import { Menu } from "./pages/admin/Menu.js";
import { Insumos } from "./pages/admin/Insumos.js";
import { Configuracion } from "./pages/admin/Configuracion.js";

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OfflineBanner />
      <NavBar />
      <main className="flex-1 min-h-0">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/pos" replace /> : <Login />} />
          <Route path="/pos" element={user ? <Pos /> : <Navigate to="/login" replace />} />
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/caja" element={user ? <Caja /> : <Navigate to="/login" replace />} />
          <Route path="/historico" element={user ? <Historico /> : <Navigate to="/login" replace />} />
          <Route
            path="/admin/menu"
            element={
              <RoleRoute roles={["ADMIN"]}>
                <Menu />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/insumos"
            element={
              <RoleRoute roles={["ADMIN"]}>
                <Insumos />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/configuracion"
            element={
              <RoleRoute roles={["ADMIN"]}>
                <Configuracion />
              </RoleRoute>
            }
          />
          <Route path="*" element={<Navigate to={user ? "/pos" : "/login"} replace />} />
        </Routes>
      </main>
    </div>
  );
}
