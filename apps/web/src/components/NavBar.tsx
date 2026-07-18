import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth.js";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
  }`;

export function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto px-3 py-2 border-b bg-white sticky top-0 z-10">
      <NavLink to="/pos" className={linkClass}>
        Venta
      </NavLink>
      <NavLink to="/dashboard" className={linkClass}>
        Ventas del evento
      </NavLink>
      <NavLink to="/caja" className={linkClass}>
        Caja
      </NavLink>
      {user.role === "ADMIN" && (
        <>
          <NavLink to="/admin/menu" className={linkClass}>
            Menú
          </NavLink>
          <NavLink to="/admin/insumos" className={linkClass}>
            Insumos
          </NavLink>
          <NavLink to="/admin/usuarios" className={linkClass}>
            Usuarios
          </NavLink>
        </>
      )}
      <div className="ml-auto flex items-center gap-2 pl-2">
        <span className="text-sm text-slate-500 hidden sm:inline">
          {user.name} · {user.role === "ADMIN" ? "Admin" : "Cajero"}
        </span>
        <button onClick={logout} className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md">
          Salir
        </button>
      </div>
    </nav>
  );
}
