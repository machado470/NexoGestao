import React, {
  createContext,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { normalizeRole, type Role } from "@/lib/rbac";

type AuthUser = {
  token?: string;
  id?: number;
  organizationId?: number;
  role?: string;
  email?: string;
  name?: string;
  normalizedRole: Role | null;
} | null;

interface AuthContextType {
  user: AuthUser;
  loading: boolean;
  isInitializing: boolean;
  isSubmitting: boolean;
  isAuthenticating: boolean;
  isLoggingOut: boolean;
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
  payload: unknown;
  redirectTo: string;
  role: Role | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* =========================
   HELPERS
========================= */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getEnvelope(payload: unknown): Record<string, unknown> | null {
  if (!isObject(payload)) return null;

  if (isObject(payload.data) && isObject(payload.data.data)) {
    return payload.data.data;
  }

  return payload;
}

function getUser(payload: unknown) {
  const env = getEnvelope(payload);
  if (!env) return null;

  const raw = (env.user ?? env) as Record<string, unknown>;

  if (!isObject(raw)) return null;

  return {
    token: raw.token as string | undefined,
    id: raw.id as number | undefined,
    organizationId: (raw.organizationId ?? raw.orgId) as number | undefined,
    role: raw.role as string | undefined,
    email: raw.email as string | undefined,
    name: raw.name as string | undefined,
  };
}

function getRedirect(payload: unknown): string {
  const env = getEnvelope(payload);
  return (env?.redirect as string) || "/executive-dashboard";
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  window.location.replace("/login");
}

/* ========================= */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<unknown | null>(null);
  const [forcedLoggedOut, setForcedLoggedOut] = useState(false);

  const meQuery = trpc.session.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const loginMutation = trpc.nexo.auth.login.useMutation();
  const registerMutation = trpc.nexo.auth.register.useMutation();
  const logoutMutation = trpc.session.logout.useMutation();

  const refresh = useCallback(async () => {
    setLocalError(null);
    await utils.session.me.invalidate();
    await meQuery.refetch();
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

        setForcedLoggedOut(false);
        queryClient.removeQueries();
        await meQuery.refetch();
      } catch (err) {
        setLocalError(err);
        throw err;
      } finally {
        setLocalLoading(false);
      }
    },
    [loginMutation, meQuery, queryClient]
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

        setForcedLoggedOut(false);
        queryClient.removeQueries();
        await meQuery.refetch();
      } catch (err) {
        setLocalError(err);
        throw err;
      } finally {
        setLocalLoading(false);
      }
    },
    [registerMutation, meQuery, queryClient]
  );

  const logout = useCallback(async () => {
    setLocalLoading(true);
    setLocalError(null);
    setForcedLoggedOut(true);

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.clear();
        window.localStorage.removeItem("nexo:last-action-flow");
        window.localStorage.removeItem("onboarding-state");
      }
      await utils.session.me.cancel();
      utils.session.me.setData(undefined, null);
      await utils.session.me.invalidate();
      queryClient.clear();
      await logoutMutation.mutateAsync();

      redirectToLogin();
    } catch (err) {
      setLocalError(err);
      redirectToLogin();
    } finally {
      setLocalLoading(false);
    }
  }, [logoutMutation, queryClient, utils]);

  const payload = forcedLoggedOut ? null : meQuery.data ?? null;

  const user: AuthUser = useMemo(() => {
    const raw = getUser(payload);
    if (!raw) return null;

    return {
      ...raw,
      normalizedRole: normalizeRole(raw.role),
    };
  }, [payload]);

  const role = user?.normalizedRole ?? null;
  const redirectTo = useMemo(() => getRedirect(payload), [payload]);

  const isAuthenticating =
    localLoading || loginMutation.isPending || registerMutation.isPending;

  const isLoggingOut = logoutMutation.isPending;
  const isSubmitting = isAuthenticating;

  /* 🔥 CORREÇÃO AQUI */
  const isInitializing =
    !forcedLoggedOut &&
    meQuery.isLoading &&
    meQuery.data === undefined &&
    !isLoggingOut;

  const loading = isInitializing || isSubmitting;

  const value: AuthContextType = {
    user,
    payload,
    redirectTo,
    role,
    loading,
    isInitializing,
    isSubmitting,
    isAuthenticating,
    isLoggingOut,
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
