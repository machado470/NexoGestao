import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SessionMeOutput = RouterOutputs["session"]["me"]; // pode ser null (se sem cookie/sem sessão)
type SessionPayload = Exclude<SessionMeOutput, null>;
type SessionUser = SessionPayload["data"]["user"];

interface AuthContextType {
  user: SessionUser | null;
  loading: boolean;
  error: unknown | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { orgName: string; adminName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  payload: SessionMeOutput; // útil pra acessar operational/pending/assignments
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<unknown | null>(null);

  // Fonte única de verdade da sessão
  const meQuery = trpc.session.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Login via proxy (define cookie httpOnly)
  const loginMutation = trpc.nexo.auth.login.useMutation();

  // Register via canonical proxy route (cria tenant + admin)
  const registerMutation = trpc.nexo.bootstrap.firstAdmin.useMutation();

  // Logout limpa cookie
  const logoutMutation = trpc.session.logout.useMutation();

  const refresh = useCallback(async () => {
    await meQuery.refetch();
  }, [meQuery]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLocalLoading(true);
      setLocalError(null);

      try {
        await loginMutation.mutateAsync({ email, password });
        await meQuery.refetch();
      } catch (err) {
        setLocalError(err);
        throw err;
      } finally {
        setLocalLoading(false);
      }
    },
    [loginMutation, meQuery]
  );


  const register = useCallback(
    async (payload: { orgName: string; adminName: string; email: string; password: string }) => {
      setLocalLoading(true);
      setLocalError(null);

      try {
        await registerMutation.mutateAsync(payload);
        await loginMutation.mutateAsync({ email: payload.email, password: payload.password });
        await meQuery.refetch();
      } catch (err) {
        setLocalError(err);
        throw err;
      } finally {
        setLocalLoading(false);
      }
    },
    [registerMutation, loginMutation, meQuery]
  );

  const logout = useCallback(async () => {
    setLocalLoading(true);
    setLocalError(null);

    try {
      await logoutMutation.mutateAsync();
      await meQuery.refetch();
    } catch (err) {
      setLocalError(err);
    } finally {
      setLocalLoading(false);
    }
  }, [logoutMutation, meQuery]);

  // session.me retorna { ok, data: {...} } | null
  const payload: SessionMeOutput = meQuery.data ?? null;

  const user: SessionUser | null = useMemo(() => {
    if (!payload) return null;
    return payload.data?.user ?? null;
  }, [payload]);

  const value: AuthContextType = useMemo(() => {
    return {
      user,
      payload,
      loading:
        localLoading ||
        meQuery.isLoading ||
        loginMutation.isPending ||
        registerMutation.isPending ||
        logoutMutation.isPending,
      error:
        localError ||
        meQuery.error ||
        loginMutation.error ||
        registerMutation.error ||
        logoutMutation.error ||
        null,
      login,
      register,
      logout,
      isAuthenticated: Boolean(user),
      refresh,
    };
  }, [
    user,
    payload,
    localLoading,
    localError,
    meQuery.isLoading,
    meQuery.error,
    loginMutation.isPending,
    loginMutation.error,
    registerMutation.isPending,
    registerMutation.error,
    logoutMutation.isPending,
    logoutMutation.error,
    login,
    register,
    logout,
    refresh,
  ]);

  // Guarda payload completo da sessão (user + operational + pending + etc)
  useEffect(() => {
    try {
      localStorage.setItem("manus-runtime-user-info", JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [payload]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
