import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User, Organization } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { getOrganizationById } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  org: Organization | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let org: Organization | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
    // Try to get organization from session or request
    const orgId = (opts.req as any).session?.organizationId;
    if (orgId) {
      org = await getOrganizationById(orgId);
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
    org = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    org,
  };
}
