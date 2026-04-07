import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Check,
  Copy,
  Gift,
  Loader2,
  Share2,
  TrendingUp,
  Users,
} from "lucide-react";

type ReferralStats = {
  totalReferrals: number;
  completedReferrals: number;
  totalCredits: number;
};

type ReferralBalance = {
  available: number;
  used: number;
};

type ReferralItem = {
  id: string;
  referredUserName: string | null;
  referredUserEmail: string | null;
  creditAmount: number;
  status: string | null;
  createdAt: string | null;
};

type ReferralListResponse = {
  data: ReferralItem[];
};

type GenerateCodeResponse = {
  code: string;
  referralUrl: string;
};

function formatMoney(value: number) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function normalizeStatsPayload(payload: unknown): ReferralStats {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return {
      totalReferrals: 0,
      completedReferrals: 0,
      totalCredits: 0,
    };
  }

  const candidate = raw as Partial<ReferralStats>;

  return {
    totalReferrals:
      typeof candidate.totalReferrals === "number" &&
      Number.isFinite(candidate.totalReferrals)
        ? candidate.totalReferrals
        : 0,
    completedReferrals:
      typeof candidate.completedReferrals === "number" &&
      Number.isFinite(candidate.completedReferrals)
        ? candidate.completedReferrals
        : 0,
    totalCredits:
      typeof candidate.totalCredits === "number" &&
      Number.isFinite(candidate.totalCredits)
        ? candidate.totalCredits
        : 0,
  };
}

function normalizeBalancePayload(payload: unknown): ReferralBalance {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return {
      available: 0,
      used: 0,
    };
  }

  const candidate = raw as Partial<ReferralBalance>;

  return {
    available:
      typeof candidate.available === "number" && Number.isFinite(candidate.available)
        ? candidate.available
        : 0,
    used: typeof candidate.used === "number" && Number.isFinite(candidate.used)
      ? candidate.used
      : 0,
  };
}

function normalizeListPayload(payload: unknown): ReferralItem[] {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw.map((item) => normalizeReferralItem(item));
  }

  if (raw && typeof raw === "object" && Array.isArray((raw as ReferralListResponse).data)) {
    return (raw as ReferralListResponse).data.map((item) => normalizeReferralItem(item));
  }

  return [];
}

function normalizeReferralItem(item: unknown): ReferralItem {
  const candidate = (item ?? {}) as Partial<ReferralItem>;

  return {
    id: typeof candidate.id === "string" ? candidate.id : "",
    referredUserName:
      typeof candidate.referredUserName === "string"
        ? candidate.referredUserName
        : null,
    referredUserEmail:
      typeof candidate.referredUserEmail === "string"
        ? candidate.referredUserEmail
        : null,
    creditAmount:
      typeof candidate.creditAmount === "number" && Number.isFinite(candidate.creditAmount)
        ? candidate.creditAmount
        : 0,
    status: typeof candidate.status === "string" ? candidate.status : null,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : null,
  };
}

function normalizeGenerateCodePayload(payload: unknown): GenerateCodeResponse | null {
  const raw = (payload as { data?: unknown } | null | undefined)?.data ?? payload;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<GenerateCodeResponse>;

  return {
    code: typeof candidate.code === "string" ? candidate.code : "",
    referralUrl:
      typeof candidate.referralUrl === "string" ? candidate.referralUrl : "",
  };
}

function getReferralStatusLabel(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "COMPLETED":
      return "Concluída";
    case "CANCELLED":
      return "Cancelada";
    case "EXPIRED":
      return "Expirada";
    default:
      return status || "N/A";
  }
}

export default function ReferralsPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;

  const [referralCode, setReferralCode] = useState("");
  const [referralUrl, setReferralUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const generateCodeMutation = trpc.referrals.generateCode.useMutation({
    onSuccess: (data) => {
      const normalized = normalizeGenerateCodePayload(data);

      setReferralCode(normalized?.code ?? "");
      setReferralUrl(normalized?.referralUrl ?? "");
      toast.success("Código de referência gerado com sucesso.");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar código de referência.");
    },
  });

  const statsQuery = trpc.referrals.stats.useQuery(
    { page: 1, limit: 100 },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const referralsQuery = trpc.referrals.list.useQuery(
    { page: 1, limit: 20 },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const creditsQuery = trpc.referrals.getBalance.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!generateCodeMutation.data) return;

    const normalized = normalizeGenerateCodePayload(generateCodeMutation.data);
    setReferralCode(normalized?.code ?? "");
    setReferralUrl(normalized?.referralUrl ?? "");
  }, [generateCodeMutation.data]);

  const stats = useMemo(() => normalizeStatsPayload(statsQuery.data), [statsQuery.data]);
  const credits = useMemo(
    () => normalizeBalancePayload(creditsQuery.data),
    [creditsQuery.data]
  );
  const referrals = useMemo(
    () => normalizeListPayload(referralsQuery.data),
    [referralsQuery.data]
  );

  const isLoadingCards =
    statsQuery.isLoading || referralsQuery.isLoading || creditsQuery.isLoading;

  const hasTopLevelError =
    statsQuery.isError || creditsQuery.isError;

  const handleGenerateCode = async () => {
    await generateCodeMutation.mutateAsync();
  };

  const handleCopyCode = async () => {
    if (!referralUrl) {
      toast.error("Nenhum link de referência disponível para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      toast.success("Link copiado com sucesso.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  if (isInitializing) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
        <div className="rounded-xl border p-4 text-sm opacity-70 dark:border-zinc-800">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
        <div className="rounded-xl border p-4 text-sm opacity-70 dark:border-zinc-800">
          Faça login para visualizar referências.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          Sistema de Referências
        </h1>
        <p className="text-lg font-semibold italic text-gray-600 dark:text-gray-300">
          "Se você conecta pessoas, você faz parte do valor"
        </p>
      </div>

      {hasTopLevelError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Erro ao carregar dados de referências
          </div>
          <p className="mt-2">
            Parte dos indicadores não pôde ser carregada agora.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
              <Users className="h-4 w-4" />
              Total de Referências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoadingCards ? "..." : stats.totalReferrals}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {isLoadingCards ? "..." : stats.completedReferrals} concluídas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
              <Gift className="h-4 w-4" />
              Créditos Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {isLoadingCards ? "..." : formatMoney(stats.totalCredits)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Total acumulado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
              <TrendingUp className="h-4 w-4" />
              Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-300">
              {isLoadingCards ? "..." : formatMoney(credits.available)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Pronto para usar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
              <Check className="h-4 w-4" />
              Utilizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {isLoadingCards ? "..." : formatMoney(credits.used)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Já resgatados
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Seu Código de Referência
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Compartilhe este link com seus contatos e ganhe créditos para cada pessoa que se cadastrar.
          </p>

          {referralCode ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-gray-300 bg-gray-100 p-3 dark:border-gray-700 dark:bg-gray-800">
                  <p className="break-all font-mono text-sm text-gray-900 dark:text-white">
                    {referralUrl}
                  </p>
                </div>

                <Button
                  onClick={() => void handleCopyCode()}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const text = `Confira este sistema de gestão: ${referralUrl}`;
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text)}`,
                      "_blank"
                    );
                  }}
                >
                  Compartilhar no WhatsApp
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(
                      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                        referralUrl
                      )}`,
                      "_blank"
                    );
                  }}
                >
                  Compartilhar no Facebook
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => void handleGenerateCode()}
              className="w-full"
              disabled={generateCodeMutation.isPending}
            >
              {generateCodeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar Código de Referência"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pessoas que você indicou</CardTitle>
        </CardHeader>
        <CardContent>
          {referralsQuery.isLoading ? (
            <div className="py-8 text-center text-gray-600 dark:text-gray-400">
              Carregando referências...
            </div>
          ) : referralsQuery.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Erro ao carregar referências
              </div>
              <p className="mt-2">
                Não foi possível carregar a lista de indicações agora.
              </p>
            </div>
          ) : referrals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      Crédito Ganho
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr
                      key={referral.id}
                      className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {referral.referredUserName || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {referral.referredUserEmail || "N/A"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">
                        {formatMoney(referral.creditAmount)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {getReferralStatusLabel(referral.status)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {formatDate(referral.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Users className="mx-auto mb-3 h-12 w-12 opacity-50 dark:text-gray-600" />
              <p className="text-gray-600 dark:text-gray-400">
                Você ainda não tem nenhuma referência. Comece a compartilhar seu código.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
