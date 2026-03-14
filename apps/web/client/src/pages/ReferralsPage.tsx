import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Gift, Users, TrendingUp, Share2, Check } from "lucide-react";

function formatMoney(value: number) {
  return `R$ ${Number(value || 0).toFixed(2)}`;
}

export default function ReferralsPage() {
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralUrl, setReferralUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const generateCodeMutation = trpc.referrals.generateCode.useMutation();
  const statsQuery = trpc.referrals.stats.useQuery({ page: 1, limit: 100 });
  const referralsQuery = trpc.referrals.list.useQuery({ page: 1, limit: 20 });
  const creditsQuery = trpc.referrals.getBalance.useQuery();

  useEffect(() => {
    if (generateCodeMutation.data) {
      setReferralCode(generateCodeMutation.data.code ?? "");
      setReferralUrl(generateCodeMutation.data.referralUrl ?? "");
    }
  }, [generateCodeMutation.data]);

  const handleGenerateCode = async () => {
    await generateCodeMutation.mutateAsync();
  };

  const handleCopyCode = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = statsQuery.data;
  const credits = creditsQuery.data;
  const referrals = referralsQuery.data?.data ?? [];

  const isLoading =
    statsQuery.isLoading || referralsQuery.isLoading || creditsQuery.isLoading;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Sistema de Referências
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 italic font-semibold">
          "Se você conecta pessoas, você faz parte do valor"
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total de Referências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? "..." : stats?.totalReferrals ?? 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {isLoading ? "..." : stats?.completedReferrals ?? 0} concluídas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Créditos Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {isLoading ? "..." : formatMoney(stats?.totalCredits ?? 0)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Total acumulado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {isLoading ? "..." : formatMoney(credits?.available ?? 0)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Pronto para usar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Utilizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {isLoading ? "..." : formatMoney(credits?.used ?? 0)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Já resgatados
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
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
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg border border-gray-300 dark:border-gray-700">
                  <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                    {referralUrl}
                  </p>
                </div>

                <Button
                  onClick={handleCopyCode}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
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
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                >
                  Compartilhar no WhatsApp
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(
                      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`,
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
              onClick={handleGenerateCode}
              className="w-full"
              disabled={generateCodeMutation.isPending}
            >
              {generateCodeMutation.isPending
                ? "Gerando..."
                : "Gerar Código de Referência"}
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
            <div className="text-center py-8 text-gray-600 dark:text-gray-400">
              Carregando referências...
            </div>
          ) : referrals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Nome
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Crédito Ganho
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral: any) => (
                    <tr
                      key={referral.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-4 text-gray-900 dark:text-white">
                        {referral.referredUserName || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {referral.referredUserEmail || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-green-600 dark:text-green-400 font-semibold">
                        {formatMoney(referral.creditAmount ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {referral.status || "N/A"}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {referral.createdAt
                          ? new Date(referral.createdAt).toLocaleDateString("pt-BR")
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3 opacity-50" />
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
