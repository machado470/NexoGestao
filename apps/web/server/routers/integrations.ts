import { protectedProcedure, router } from "../_core/trpc";
import { nexoFetch } from "../_core/nexoClient";

export const integrationsRouter = router({
  readiness: protectedProcedure.query(async ({ ctx }) => {
    const raw = await nexoFetch<any>(ctx.req, "/health/readiness", {
      method: "GET",
    });
    return raw?.data ?? raw ?? null;
  }),
});
