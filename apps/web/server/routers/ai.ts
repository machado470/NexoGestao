import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

/**
 * AI Router — integração com LLM para análise operacional.
 * Centraliza chamadas de IA para auditabilidade e controle de custos.
 */
export const aiRouter = router({
  /**
   * Análise genérica com LLM
   * Recebe um prompt e dados opcionais, retorna análise textual.
   */
  analyze: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1),
        data: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const systemPrompt = `Você é um assistente de gestão operacional do NexoGestão.
Analise os dados fornecidos e responda de forma objetiva e prática.
Foque em insights acionáveis para pequenas e médias empresas.
Responda sempre em português brasileiro.`;

        const userContent = input.data
          ? `${input.prompt}\n\nDados:\n${JSON.stringify(input.data, null, 2)}`
          : input.prompt;

        const result = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        });

        const text = result?.choices?.[0]?.message?.content ?? "";
        return {
          ok: true,
          data: {
            analysis: text,
            prompt: input.prompt,
          },
        };
      } catch (err: any) {
        // Fallback gracioso se LLM não estiver disponível
        return {
          ok: false,
          data: {
            analysis: "Serviço de IA temporariamente indisponível.",
            prompt: input.prompt,
            error: err?.message,
          },
        };
      }
    }),

  /**
   * Sugestão de ação para cliente em risco
   * Recebe dados do cliente e retorna sugestões de ação.
   */
  suggestAction: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        customerName: z.string(),
        riskScore: z.number().min(0).max(100),
        issues: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um consultor de gestão de clientes do NexoGestão.
Analise o perfil de risco do cliente e sugira ações práticas e específicas.
Seja direto e objetivo. Máximo 3 sugestões. Responda em português brasileiro.`,
            },
            {
              role: "user",
              content: `Cliente: ${input.customerName}
Score de risco: ${input.riskScore}/100
Problemas identificados: ${(input.issues ?? []).join(", ") || "Nenhum especificado"}

Quais ações devo tomar para reduzir o risco deste cliente?`,
            },
          ],
        });

        const text = result?.choices?.[0]?.message?.content ?? "";
        return {
          ok: true,
          data: {
            customerId: input.customerId,
            suggestions: text,
          },
        };
      } catch {
        return {
          ok: false,
          data: {
            customerId: input.customerId,
            suggestions: "Serviço de IA temporariamente indisponível.",
          },
        };
      }
    }),

  /**
   * Geração de resumo de relatório operacional
   * Recebe métricas e retorna um resumo executivo.
   */
  generateReport: protectedProcedure
    .input(
      z.object({
        period: z.string().optional().default("mês atual"),
        metrics: z.record(z.string(), z.any()),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um analista de negócios do NexoGestão.
Gere um resumo executivo conciso e profissional baseado nas métricas fornecidas.
Destaque pontos positivos, alertas e recomendações. Responda em português brasileiro.`,
            },
            {
              role: "user",
              content: `Período: ${input.period}
Métricas operacionais:
${JSON.stringify(input.metrics, null, 2)}

Gere um resumo executivo para este período.`,
            },
          ],
        });

        const text = result?.choices?.[0]?.message?.content ?? "";
        return {
          ok: true,
          data: {
            period: input.period,
            report: text,
          },
        };
      } catch {
        return {
          ok: false,
          data: {
            period: input.period,
            report: "Serviço de IA temporariamente indisponível.",
          },
        };
      }
    }),
});
