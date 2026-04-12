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
  try {
    if (typeof window === "undefined") return;
    window.location.replace(`/login?logoutAt=${Date.now()}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[auth] redirect failed", error);
  }
}

function clearAppStorage() {
  try {
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[auth] clear storage failed", error);
  }
}

function createSafeBroadcastChannel(name: string) {
  try {
    if (typeof window === "undefined") return null;
    if (!("BroadcastChannel" in window)) return null;
    return new BroadcastChannel(name);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[auth] BroadcastChannel unavailable", err);
    return null;
  }
}

function isExpectedUnauthenticatedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as {
    data?: { code?: unknown; httpStatus?: unknown };
    shape?: { data?: { code?: unknown; httpStatus?: unknown } };
    message?: unknown;
  };

  const code =
    maybeError.data?.code ??
    maybeError.shape?.data?.code ??
    (typeof maybeError.message === "string" ? maybeError.message : null);
  const httpStatus =
    maybeError.data?.httpStatus ?? maybeError.shape?.data?.httpStatus;

  if (httpStatus === 401) return true;
  if (code === "UNAUTHORIZED") return true;
  if (typeof code === "string" && code.toLowerCase().includes("unauthorized")) {
    return true;
  }

  return false;
}

/* ========================= */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<unknown | null>(null);
  const [forcedLoggedOut, setForcedLoggedOut] = useState(false);
  const [meBootstrapTimedOut, setMeBootstrapTimedOut] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [pathname, setPathname] = useState(() => {
    try {
      if (typeof window === "undefined") return "/";
      return window.location.pathname;
    } catch {
      return "/";
    }
  });

  const isAuthPath = AUTH_PATH_PREFIXES.some(prefix =>
    pathname.startsWith(prefix)
  );
  const isMarketingPath = MARKETING_PATHS.has(pathname);
  const shouldBootstrapSession = isAuthPath || !isMarketingPath;
  const syncEventRef = useRef<(payload: unknown) => Promise<void>>(async () => {});

  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[boot] auth init");
    }
  }, []);

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

    if (typeof window === "undefined") return;

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
      try {
        if (evt.key !== "nexo:auth:logout-at" || !evt.newValue) return;
        setForcedLoggedOut(true);
        queryClient.clear();
        redirectToLogin();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[auth] storage logout sync failed", err);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [queryClient]);

  useEffect(() => {
    channelRef.current = createSafeBroadcastChannel("nexo-auth");

    if (!channelRef.current) return;

    const handler = (event: MessageEvent) => {
      void syncEventRef.current(event?.data);
    };

    channelRef.current.addEventListener("message", handler);

    return () => {
      try {
        channelRef.current?.removeEventListener("message", handler);
        channelRef.current?.close();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[auth] failed to close BroadcastChannel", error);
      }
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (channelRef.current) return;

    const handler = (event: StorageEvent) => {
      if (event.key !== "nexo-auth-sync" || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue);
        void syncEventRef.current(parsed);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[auth] storage sync parse failed", err);
      }
    };

    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("storage", handler);
    };
  }, []);

  const emitAuthSync = useCallback((type: "login" | "logout") => {
    if (typeof window === "undefined") return;
    try {
      const payload = { type, at: Date.now() };
      if (channelRef.current) {
        channelRef.current.postMessage(payload);
        return;
      }
      window.localStorage.setItem("nexo-auth-sync", JSON.stringify(payload));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[auth] sync emit failed", err);
    }
  }, []);

  useEffect(() => {
    syncEventRef.current = async payload => {
      try {
        const type = String((payload as { type?: unknown })?.type ?? "");
        if (type === "logout") {
          setForcedLoggedOut(true);
          await utils.session.me.cancel();
          utils.session.me.setData(undefined, null);
          queryClient.clear();
          redirectToLogin();
          return;
        }

        if (type === "login") {
          setForcedLoggedOut(false);
          await utils.session.me.invalidate();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[auth] sync event failed", err);
      }
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
        emitAuthSync("login");
      } catch (err) {
        setLocalError(err);
        throw err;
      } finally {
        setLocalLoading(false);
      }
    },
    [emitAuthSync, loginMutation, meQuery, queryClient]
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
          emitAuthSync("login");
        }

        return result;
      } catch (err) {
        setLocalError(err);
        throw err;
      } finally {
        setLocalLoading(false);
      }
    },
    [emitAuthSync, registerMutation, meQuery, queryClient]
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
      emitAuthSync("logout");
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
  }, [emitAuthSync, logoutMutation, queryClient, utils]);

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
  const meBootstrapError =
    shouldBootstrapSession && !isExpectedUnauthenticatedError(meQuery.error)
      ? meQuery.error
      : null;

  const isInitializing =
    shouldBootstrapSession &&
    !forcedLoggedOut &&
    meQuery.isLoading &&
    meQuery.data === undefined &&
    !meBootstrapTimedOut &&
    !isLoggingOut;

  const loading = isInitializing || isSubmitting;
  const userSafe = user ?? null;
  const isReady = !loading;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log("[boot] auth provider render", {
      pathname,
      shouldBootstrapSession,
      forcedLoggedOut,
      isInitializing,
      isReady,
      loading,
      isAuthenticated: Boolean(userSafe),
      userId: userSafe?.id ?? null,
      meFetchStatus: meQuery.fetchStatus,
    });
  }

  useEffect(() => {
    if (!isReady) return;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log("[boot] auth ready");
    }
  }, [isReady]);

  useEffect(() => {
    const bootstrapError =
      localError ||
      meBootstrapError ||
      loginMutation.error ||
      registerMutation.error ||
      logoutMutation.error ||
      null;

    if (!bootstrapError) return;
    // eslint-disable-next-line no-console
    console.error("[boot] auth error", bootstrapError);
    // eslint-disable-next-line no-console
    console.error("[auth] bootstrap failed", bootstrapError);
  }, [
    localError,
    loginMutation.error,
    logoutMutation.error,
    meBootstrapError,
    registerMutation.error,
  ]);

  const value: AuthContextType = {
    user: userSafe,
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
      meBootstrapError ||
      loginMutation.error ||
      registerMutation.error ||
      logoutMutation.error ||
      null,
    login,
    register,
    logout,
    isAuthenticated: Boolean(userSafe),
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
