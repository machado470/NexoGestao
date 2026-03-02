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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const registerMutation = trpc.auth.register.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.session.logout.useMutation();

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
        // Armazenar dados da organização
        localStorage.setItem("organization", JSON.stringify(result));
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Erro ao registrar");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [registerMutation]
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
        setUser(result.organization);
        localStorage.setItem("organization", JSON.stringify(result.organization));
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Erro ao fazer login");
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [loginMutation]
  );

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await logoutMutation.mutateAsync();
      setUser(null);
      localStorage.removeItem("organization");
    } catch (err) {
      console.error("Erro ao fazer logout:", err);
    } finally {
      setLoading(false);
    }
  }, [logoutMutation]);

  // Verificar se há organização armazenada
  useEffect(() => {
    const storedOrg = localStorage.getItem("organization");
    if (storedOrg) {
      try {
        setUser(JSON.parse(storedOrg));
      } catch (err) {
        console.error("Erro ao restaurar organização:", err);
      }
    }
  }, []);

  const value: AuthContextType = {
    user,
    loading: loading || registerMutation.isPending || loginMutation.isPending,
    error: error || registerMutation.error || loginMutation.error,
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
