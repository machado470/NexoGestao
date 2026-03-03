import React, { createContext, useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

interface AuthContextType {
  user: any | null;
  loading: boolean;
  error: any | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, orgName: string, adminName?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const registerMutation = trpc.auth.register.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.session.logout.useMutation();
  const meQuery = trpc.session.me.useQuery(undefined, {
    retry: false,
    staleTime: Infinity,
  });

  const register = useCallback(
    async (email: string, password: string, orgName: string, adminName: string = "Admin") => {
      try {
        setLoading(true);
        setError(null);
        const result = await registerMutation.mutateAsync({
          email,
          password,
          orgName,
          adminName,
        });
        console.log("Registro bem-sucedido:", result);
        // Refetch meQuery para obter dados da sessão
        await meQuery.refetch();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Erro ao registrar");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [registerMutation, meQuery]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        setError(null);
        const result = await loginMutation.mutateAsync({
          email,
          password,
        });
        console.log("Login bem-sucedido:", result);
        // Refetch meQuery para obter dados da sessão
        await meQuery.refetch();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Erro ao fazer login");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [loginMutation, meQuery]
  );

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await logoutMutation.mutateAsync();
      setUser(null);
      // Refetch meQuery para limpar dados da sessão
      await meQuery.refetch();
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      setLoading(false);
    }
  }, [logoutMutation, meQuery]);

  // Sincronizar estado do usuário com dados da query
  useEffect(() => {
    if (!meQuery.isLoading) {
      if (meQuery.data) {
        setUser(meQuery.data);
      } else {
        setUser(null);
      }
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [meQuery.isLoading, meQuery.data]);

  const value: AuthContextType = {
    user,
    loading: loading || meQuery.isLoading,
    error: error || meQuery.error || registerMutation.error || loginMutation.error,
    register,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
