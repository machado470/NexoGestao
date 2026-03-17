import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { normalizeRole, type Role } from "@/lib/rbac";
import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type SessionMeOutput = RouterOutputs["session"]["me"];
type SessionPayload = Exclude<SessionMeOutput, null>;
type SessionUser = NonNullable<SessionPayload["data"]>["data"]["user"];

type AuthUser = (SessionUser & { normalizedRole: Role | null }) | null;

interface AuthContextType {
  user: AuthUser;
  loading: boolean;
  isInitializing: boolean;
  isSubmitting: boolean;
  error: unknown | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    orgName: string;
    adminName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  payload: SessionMeOutput;
  redirectTo: string;
  role: Role | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSessionData(payload: SessionMeOutput) {
  return payload?.data?.data ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<unknown | null>(null);
  const [hasResolvedSession, setHasResolvedSession] = useState(false);

  const meQuery = trpc.session.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.nexo.auth.login.useMutation();
  const registerMutation = trpc.nexo.auth.register.useMutation();
  const logoutMutation = trpc.session.logout.useMutation();

  useEffect(() => {
    if (meQuery.isFetched || meQuery.error) {
      setHasResolvedSession(true);
    }
  }, [meQuery.isFetched, meQuery.error]);

  const loadSessionAfterAuth = useCallback(async () => {
    const attempts = 4;
    const delays = [0, 150, 300, 600];

    for (let index = 0; index < attempts; index++) {
      if (delays[index] > 0) {
        await sleep(delays[index]);
      }

      const result = await meQuery.refetch();
      const nextPayload = result.data ?? null;

      utils.session.me.setData(undefined, nextPayload);

      const nextUser = getSessionData(nextPayload)?.user ?? null;

      if (nextUser) {
        return nextPayload;
      }
    }

    throw new Error("Sessão não foi carregada após o login.");
  }, [meQuery, utils]);

  const refresh = useCallback(async () => {
    setLocalError(null);
    const result = await meQuery.refetch();
    utils.session.me.setData(undefined, result.data ?? null);
  }, [meQuery, utils]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLocalLoading(true);
      setLocalError(null);

      try {
        await loginMutation.mutateAsync({
          email: email.trim().toLowerCase(),
          password,
        });

        await loadSessionAfterAuth();
      } catch (err) {
        setLocalError(err);
        throw err;
      } finally {
        setLocalLoading(false);
      }
    },
    [loginMutation, loadSessionAfterAuth]
  );

  const register = useCallback(
    async (payload: {
      orgName: string;
      adminName: string;
      email: string;
      password: string;
    }) => {
      setLocalLoading(true);
      setLocalError(null);

      try {
        await registerMutation.mutateAsync({
          orgName: payload.orgName.trim(),
          adminName: payload.adminName.trim(),
          email: payload.email.trim().toLowerCase(),
          password: payload.password,
        });

        await loadSessionAfterAuth();
      } catch (err) {
        setLocalError(err);
        throw err;
      } finally {
        setLocalLoading(false);
      }
    },
    [registerMutation, loadSessionAfterAuth]
  );

  const logout = useCallback(async () => {
    setLocalLoading(true);
    setLocalError(null);

    try {
      await logoutMutation.mutateAsync();
      utils.session.me.setData(undefined, null);
      await utils.session.me.invalidate();
    } catch (err) {
      setLocalError(err);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  }, [logoutMutation, utils]);

  const payload: SessionMeOutput = meQuery.data ?? null;

  const user: AuthUser = useMemo(() => {
    const rawUser = getSessionData(payload)?.user ?? null;

    if (!rawUser) return null;

    return {
      ...rawUser,
      normalizedRole: normalizeRole(rawUser.role),
    };
  }, [payload]);

  const role = useMemo(() => {
    return user?.normalizedRole ?? null;
  }, [user]);

  const redirectTo = useMemo(() => {
    return getSessionData(payload)?.redirect ?? "/dashboard";
  }, [payload]);

  const isSubmitting =
    localLoading ||
    loginMutation.isPending ||
    registerMutation.isPending ||
    logoutMutation.isPending;

  const isInitializing = !hasResolvedSession && meQuery.isLoading;
  const loading = isInitializing || isSubmitting;

  const value: AuthContextType = useMemo(() => {
    return {
      user,
      payload,
      redirectTo,
      role,
      loading,
      isInitializing,
      isSubmitting,
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
    redirectTo,
    role,
    loading,
    isInitializing,
    isSubmitting,
    localError,
    meQuery.error,
    loginMutation.error,
    registerMutation.error,
    logoutMutation.error,
    login,
    register,
    logout,
    refresh,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
