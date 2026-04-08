import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  }) => Promise<any>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  payload: unknown;
  redirectTo: string;
  role: Role | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const APP_STORAGE_PREFIXES = ["nexo:", "nexogestao_", "pilot-onboarding:"];

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
  window.location.replace(`/login?logoutAt=${Date.now()}`);
}

function clearAppStorage() {
  if (typeof window === "undefined") return;

  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }

  for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = window.sessionStorage.key(i);
    if (!key) continue;
    if (APP_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.sessionStorage.removeItem(key);
    }
  }
}

/* ========================= */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<unknown | null>(null);
  const [forcedLoggedOut, setForcedLoggedOut] = useState(false);
  const authChannelRef = useRef<BroadcastChannel | null>(null);

  const meQuery = trpc.session.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60_000,
  });

  const loginMutation = trpc.nexo.auth.login.useMutation();
  const registerMutation = trpc.nexo.auth.register.useMutation();
  const logoutMutation = trpc.session.logout.useMutation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const channel = new BroadcastChannel("nexo-auth");
    authChannelRef.current = channel;

    channel.onmessage = async (event) => {
      const type = String(event?.data?.type ?? "");
      if (type === "logout") {
        setForcedLoggedOut(true);
        await utils.session.me.cancel();
        utils.session.me.setData(undefined, null);
        queryClient.clear();
        redirectToLogin();
      }

      if (type === "login") {
        setForcedLoggedOut(false);
        await utils.session.me.invalidate();
      }
    };

    const onStorage = (evt: StorageEvent) => {
      if (evt.key !== "nexo:auth:logout-at" || !evt.newValue) return;
      setForcedLoggedOut(true);
      queryClient.clear();
      redirectToLogin();
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      channel.close();
    };
  }, [queryClient, utils.session.me]);

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
        authChannelRef.current?.postMessage({ type: "login", at: Date.now() });
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
        const result = await registerMutation.mutateAsync({
          orgName: payload.orgName.trim(),
          adminName: payload.adminName.trim(),
          email: payload.email.trim().toLowerCase(),
          password: payload.password,
        });

        const token =
          result?.data?.data?.token ??
          result?.data?.token ??
          result?.token ??
          result?.accessToken ??
          null;

        if (typeof token === "string" && token.trim().length > 0) {
          setForcedLoggedOut(false);
          queryClient.removeQueries();
          await meQuery.refetch();
          authChannelRef.current?.postMessage({ type: "login", at: Date.now() });
        }

        return result;
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
        clearAppStorage();
        window.localStorage.setItem("nexo:auth:logout-at", String(Date.now()));
      }
      authChannelRef.current?.postMessage({ type: "logout", at: Date.now() });
      await utils.session.me.cancel();
      utils.session.me.setData(undefined, null);
      await logoutMutation.mutateAsync();
      await utils.session.me.invalidate();
      queryClient.clear();

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
