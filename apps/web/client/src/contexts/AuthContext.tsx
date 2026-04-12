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
  id?: string;
  organizationId?: string;
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
const AUTH_PATH_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/",
];
const MARKETING_PATHS = new Set([
  "/",
  "/about",
  "/sobre",
  "/produto",
  "/precos",
  "/contato",
]);

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

  const normalizeIdentifier = (value: unknown): string | undefined => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || undefined;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  };

  return {
    token: raw.token as string | undefined,
    id: normalizeIdentifier(raw.id),
    organizationId: normalizeIdentifier(raw.organizationId ?? raw.orgId),
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
    if (APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }

  for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = window.sessionStorage.key(i);
    if (!key) continue;
    if (APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
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
  const [meBootstrapTimedOut, setMeBootstrapTimedOut] = useState(false);
  const authChannelRef = useRef<BroadcastChannel | null>(null);
  const [pathname, setPathname] = useState(() => {
    if (typeof window === "undefined") return "/";
    return window.location.pathname;
  });

  const isAuthPath = AUTH_PATH_PREFIXES.some(prefix =>
    pathname.startsWith(prefix)
  );
  const isMarketingPath = MARKETING_PATHS.has(pathname);
  const shouldBootstrapSession = isAuthPath || !isMarketingPath;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updatePathname = () => setPathname(window.location.pathname);
    const { history } = window;
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = function (...args) {
      originalPushState(...args);
      updatePathname();
    };

    history.replaceState = function (...args) {
      originalReplaceState(...args);
      updatePathname();
    };

    window.addEventListener("popstate", updatePathname);
    window.addEventListener("hashchange", updatePathname);

    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", updatePathname);
      window.removeEventListener("hashchange", updatePathname);
    };
  }, []);

  const meQuery = trpc.session.me.useQuery(undefined, {
    enabled: shouldBootstrapSession && !forcedLoggedOut,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60_000,
  });

  const loginMutation = trpc.nexo.auth.login.useMutation();
  const registerMutation = trpc.nexo.auth.register.useMutation();
  const logoutMutation = trpc.session.logout.useMutation();
  const isLoggingOut = logoutMutation.isPending;

  useEffect(() => {
    if (forcedLoggedOut) {
      setMeBootstrapTimedOut(false);
      return;
    }

    const shouldTrackTimeout =
      shouldBootstrapSession &&
      meQuery.data === undefined &&
      meQuery.fetchStatus === "fetching" &&
      !meQuery.error &&
      !isLoggingOut;

    if (!shouldTrackTimeout) {
      setMeBootstrapTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setMeBootstrapTimedOut(true);
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[auth] session.me timeout exceeded. Public routes will continue rendering."
        );
      }
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [
    forcedLoggedOut,
    isLoggingOut,
    meQuery.data,
    meQuery.error,
    meQuery.fetchStatus,
    shouldBootstrapSession,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (evt: StorageEvent) => {
      if (evt.key !== "nexo:auth:logout-at" || !evt.newValue) return;
      setForcedLoggedOut(true);
      queryClient.clear();
      redirectToLogin();
    };

    window.addEventListener("storage", onStorage);

    if (typeof window.BroadcastChannel !== "function") {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn("[auth] BroadcastChannel indisponível; sincronização entre abas desativada.");
      }
      authChannelRef.current = null;
      return () => {
        window.removeEventListener("storage", onStorage);
      };
    }

    let channel: BroadcastChannel | null = null;

    try {
      channel = new window.BroadcastChannel("nexo-auth");
      authChannelRef.current = channel;

      channel.onmessage = async event => {
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
    } catch (error) {
      authChannelRef.current = null;
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error("[auth] Falha ao inicializar BroadcastChannel", error);
      }
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
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
          authChannelRef.current?.postMessage({
            type: "login",
            at: Date.now(),
          });
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

  const payload =
    forcedLoggedOut || !shouldBootstrapSession ? null : (meQuery.data ?? null);

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

  const isSubmitting = isAuthenticating;

  const isInitializing =
    shouldBootstrapSession &&
    !forcedLoggedOut &&
    meQuery.isLoading &&
    meQuery.data === undefined &&
    !meBootstrapTimedOut &&
    !isLoggingOut;

  const loading = isInitializing || isSubmitting;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[boot] auth provider render", {
      pathname,
      shouldBootstrapSession,
      forcedLoggedOut,
      isInitializing,
      loading,
      isAuthenticated: Boolean(user),
      userId: user?.id ?? null,
      meFetchStatus: meQuery.fetchStatus,
    });
  }

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
      (shouldBootstrapSession ? meQuery.error : null) ||
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
