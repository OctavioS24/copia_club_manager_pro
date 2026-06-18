
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUserRef = React.useRef<User | null>(null);

  useEffect(() => {
    // 1. Verificar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleUserChange(session?.user ?? null);
    });

    // 2. Escuchar cambios de estado (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUserChange(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUserChange = async (authUser: User | null) => {
    // Si ya teníamos el mismo usuario verificado, evitamos reiniciar el estado loading
    if (authUser && currentUserRef.current && authUser.id === currentUserRef.current.id) {
      currentUserRef.current = authUser;
      setUser(authUser);
      return;
    }

    // Evitar relámpagos si pasamos de null a null
    if (!authUser && !currentUserRef.current && !loading) {
      return;
    }

    const isFirstLoadOrChange = !currentUserRef.current || !authUser || currentUserRef.current.id !== authUser.id;
    if (isFirstLoadOrChange) {
      setLoading(true);
    }
    setError(null);

    if (!authUser) {
      currentUserRef.current = null;
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      // 3. Verificar contra la tabla members (ignorando mayúsculas/minúsculas)
      const { data: member, error: dbError } = await supabase
        .from('members')
        .select('systemrole')
        .ilike('email', authUser.email || '')
        .single();

      if (dbError || !member) {
        // El email no existe en la tabla members
        await supabase.auth.signOut();
        currentUserRef.current = null;
        setUser(null);
        setRole(null);
        setError('Tu correo no está registrado en el sistema. Contacta al administrador.');
      } else if (!member.systemrole) {
        // Existe pero no tiene rol asignado
        await supabase.auth.signOut();
        currentUserRef.current = null;
        setUser(null);
        setRole(null);
        setError('Tu usuario aún no tiene un rol asignado. Contacta al administrador.');
      } else {
        // Todo OK: Guardar usuario y su rol
        currentUserRef.current = authUser;
        setUser(authUser);
        setRole(member.systemrole);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      setError('Ocurrió un error al verificar tus permisos.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    currentUserRef.current = null;
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signInWithGoogle, signOut, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
