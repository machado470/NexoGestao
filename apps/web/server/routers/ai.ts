import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

export const aiRouter = router({
  chat: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1, "Mensagem não pode estar vazia"),
        context: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const systemPrompt = `Você é um assistente de IA para o sistema NexoGestão, uma plataforma de gestão de agendamentos e clientes.
${input.context ? `Contexto adicional: ${input.context}` : ""}
Responda de forma útil, concisa e profissional. Use português brasileiro.`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.message },
          ],
        });

        const content = response.choices[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

        return {
          success: true,
          message: content,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error("AI Chat Error:", error);
        return {
          success: false,
          message: "Erro ao processar sua pergunta. Tente novamente.",
          timestamp: new Date(),
        };
      }
    }),

  generateReport: protectedProcedure
    .input(
      z.object({
        type: z.enum(["SUMMARY", "ANALYSIS", "RECOMMENDATION"]),
        data: z.record(z.any()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const prompts: Record<string, string> = {
          SUMMARY: `Gere um resumo executivo dos seguintes dados:\n${JSON.stringify(input.data, null, 2)}`,
          ANALYSIS: `Analise os seguintes dados e identifique padrões e insights:\n${JSON.stringify(input.data, null, 2)}`,
          RECOMMENDATION: `Com base nos seguintes dados, forneça recomendações de ação:\n${JSON.stringify(input.data, null, 2)}`,
        };

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Você é um analista de negócios experiente. Forneça insights acionáveis e recomendações práticas.",
            },
            { role: "user", content: prompts[input.type] },
          ],
        });

        const content = response.choices[0]?.message?.content || "Não foi possível gerar o relatório.";

        return {
          success: true,
          report: content,
          type: input.type,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error("Report Generation Error:", error);
        return {
          success: false,
          report: "Erro ao gerar relatório. Tente novamente.",
          type: input.type,
          timestamp: new Date(),
        };
      }
    }),

  suggestActions: protectedProcedure
    .input(
      z.object({
        situation: z.string().min(1, "Descrição da situação é obrigatória"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um consultor de negócios especializado em gestão de agendamentos e clientes.
Forneça 3-5 ações práticas e específicas que podem ser implementadas imediatamente.
Formato: Lista numerada com ações concretas.`,
            },
            { role: "user", content: `Situação: ${input.situation}` },
          ],
        });

        const content = response.choices[0]?.message?.content || "Não foi possível gerar sugestões.";

        return {
          success: true,
          suggestions: content,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error("Suggestions Error:", error);
        return {
          success: false,
          suggestions: "Erro ao gerar sugestões. Tente novamente.",
          timestamp: new Date(),
        };
      }
    }),

  predictTrend: protectedProcedure
    .input(
      z.object({
        metric: z.string(),
        historicalData: z.array(z.number()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Você é um analista de dados especializado em previsão de tendências.
Analise os dados históricos fornecidos e forneça uma previsão para os próximos períodos.
Inclua: tendência (alta/baixa/estável), confiança (alta/média/baixa), e recomendações.`,
            },
            {
              role: "user",
              content: `Métrica: ${input.metric}\nDados históricos: ${input.historicalData.join(", ")}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content || "Não foi possível fazer a previsão.";

        return {
          success: true,
          prediction: content,
          metric: input.metric,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error("Prediction Error:", error);
        return {
          success: false,
          prediction: "Erro ao fazer previsão. Tente novamente.",
          metric: input.metric,
          timestamp: new Date(),
        };
      }
    }),
});
