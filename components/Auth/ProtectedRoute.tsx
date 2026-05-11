
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SplashScreen from '../SplashScreen';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <SplashScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role) && role !== 'Admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--surface-ground)]">
        <div className="bg-surface-card border border-[var(--surface-border)] rounded-[3rem] p-12 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
          <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-8">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-4 text-[var(--text-main)]">Acceso Denegado</h2>
          <p className="text-[var(--text-muted)] font-medium leading-relaxed mb-8">
            No tienes los permisos necesarios para acceder a este módulo. Tu rol actual es <span className="text-primary-500 font-bold uppercase">{role}</span>.
          </p>
          <button 
            onClick={() => window.history.back()}
            className="w-full py-4 bg-surface-hover text-[var(--text-main)] font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all hover:bg-surface-border"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
