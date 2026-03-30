import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../lib/useSession";

type AdminRouteProps = {
  children: ReactNode;
};

export default function AdminRoute({ children }: AdminRouteProps) {
  const location = useLocation();
  const { loading, user, isPlatformAdmin } = useSession();

  if (loading) {
    return (
      <div className="centered-state">
        <section className="panel">Chargement des permissions...</section>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/events" replace />;
  }

  return <>{children}</>;
}
