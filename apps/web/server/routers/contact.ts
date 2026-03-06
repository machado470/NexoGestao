import { router, protectedProcedure } from "../_core/trpc";

/**
 * Contact router (placeholder).
 * O portal antigo salvava contatos no DB local.
 * Futuro: enviar via backend Nest ou serviço externo.
 */

export const contactRouter = router({
  status: protectedProcedure.query(async () => {
    return {
      ok: true,
      message: "Contact router placeholder",
    };
  }),
});
