import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { organizations, accounts, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import * as bcrypt from "bcrypt";

export const authRouter = router({
  // Registro de nova organização
  register: publicProcedure
    .input(
      z.object({
        orgName: z.string().min(2, "Nome da organização deve ter pelo menos 2 caracteres"),
        adminName: z.string().min(2, "Nome do admin deve ter pelo menos 2 caracteres"),
        email: z.string().email("Email inválido"),
        password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Banco de dados não disponível");
        }

        // Verificar se email já existe
        const existingOrg = await db
          .select()
          .from(organizations)
          .where(eq(organizations.email, input.email))
          .limit(1);

        if (existingOrg.length > 0) {
          throw new Error("Este email já está registrado");
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(input.password, 10);

        // Criar organização
        const result = await db.insert(organizations).values({
          name: input.orgName,
          email: input.email,
          adminName: input.adminName,
          password: hashedPassword,
        });

        // Obter o ID da organização criada
        const orgId = (result as any).insertId || 1;

        // Criar conta associada
        await db.insert(accounts).values({
          organizationId: Number(orgId),
          status: "active",
        });

        return {
          success: true,
          message: "Organização criada com sucesso!",
          organizationId: orgId,
          email: input.email,
        };
      } catch (error: any) {
        console.error("[Auth] Register failed:", error.message);
        throw new Error(`Falha ao registrar: ${error.message}`);
      }
    }),

  // Login
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Banco de dados não disponível");
        }

        // Buscar organização
        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.email, input.email))
          .limit(1);

        if (org.length === 0) {
          throw new Error("Email ou senha incorretos");
        }

        const organization = org[0];

        // Verificar senha com bcrypt
        const isPasswordValid = await bcrypt.compare(input.password, organization.password);
        if (!isPasswordValid) {
          throw new Error("Email ou senha incorretos");
        }

        return {
          success: true,
          message: "Login realizado com sucesso!",
          organization: {
            id: organization.id,
            name: organization.name,
            email: organization.email,
            adminName: organization.adminName,
          },
        };
      } catch (error: any) {
        console.error("[Auth] Login failed:", error.message);
        throw new Error(`Falha ao fazer login: ${error.message}`);
      }
    }),

  // Obter dados da organização
  getOrganization: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Banco de dados não disponível");
        }

        const org = await db
          .select()
          .from(organizations)
          .where(eq(organizations.id, input.id))
          .limit(1);

        if (org.length === 0) {
          throw new Error("Organização não encontrada");
        }

        return org[0];
      } catch (error: any) {
        console.error("[Auth] Get organization failed:", error.message);
        throw new Error(`Falha ao obter organização: ${error.message}`);
      }
    }),
});
