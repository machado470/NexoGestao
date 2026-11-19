import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { zonedMonthBounds } from "../common/zoned-month";
import {
  ProductDto,
  MovementDto,
  FiscalDraftDto,
  RecordedExpenseDto,
} from "./commerce.dto";

@Injectable()
export class CommerceService {
  constructor(private readonly db: PrismaService) {}
  private async organization(orgId: string) {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { currency: true, timezone: true },
    });
    if (!org) throw new NotFoundException("Empresa não encontrada");
    return org;
  }
  private same(existing: any, values: Record<string, unknown>) {
    if (
      Object.entries(values).some(([key, value]) =>
        existing[key] instanceof Date
          ? existing[key].toISOString() !== value
          : existing[key] !== value,
      )
    ) {
      throw new ConflictException(
        "A chave desta tentativa já foi usada com outros dados. Confira o registro antes de tentar novamente.",
      );
    }
    return existing;
  }
  async products(orgId: string, page = 1, q = "") {
    if (!Number.isInteger(page) || page < 1)
      throw new BadRequestException("Página inválida");
    if (q.length > 120) throw new BadRequestException("Busca muito longa");
    const where = {
      orgId,
      ...(q.trim()
        ? {
            OR: ["name", "sku", "barcode"].map((field) => ({
              [field]: { contains: q.trim(), mode: "insensitive" as const },
            })),
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.inventoryProduct.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: (page - 1) * 30,
        take: 30,
      }),
      this.db.inventoryProduct.count({ where }),
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / 30)) };
  }
  async createProduct(orgId: string, input: ProductDto) {
    const { currency } = await this.organization(orgId);
    if (currency !== input.expectedCurrency)
      throw new ConflictException(
        "A moeda da empresa mudou. Atualize a página antes de salvar.",
      );
    const data = {
      orgId,
      sku: input.sku.trim().toUpperCase(),
      name: input.name.trim(),
      barcode: input.barcode?.trim() || null,
      variant: input.variant?.trim() || null,
      minQuantity: input.minQuantity,
      costCents: input.costCents,
      saleCents: input.saleCents,
      currency,
    };
    if (data.name.length < 2)
      throw new BadRequestException("Informe o nome do produto");
    try {
      return await this.db.inventoryProduct.create({ data });
    } catch (error: any) {
      if (error.code !== "P2002") throw error;
      const existing = await this.db.inventoryProduct.findUnique({
        where: { orgId_sku: { orgId, sku: data.sku } },
      });
      if (!existing) throw error;
      return this.same(existing, data);
    }
  }
  async movements(orgId: string) {
    return this.db.stockMovement.findMany({
      where: { orgId },
      include: { product: { select: { name: true, sku: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    });
  }
  async move(orgId: string, actorUserId: string, input: MovementDto) {
    const values = {
      productId: input.productId,
      direction: input.direction,
      quantity: input.quantity,
      reason: input.reason.trim(),
      serviceOrderId: input.serviceOrderId || null,
    };
    if (values.reason.length < 3)
      throw new BadRequestException("Informe o motivo da movimentação");
    const existing = await this.db.stockMovement.findUnique({
      where: { orgId_entryKey: { orgId, entryKey: input.entryKey } },
    });
    if (existing) return this.same(existing, values);
    try {
      return await this.db.$transaction(async (tx) => {
        if (
          values.serviceOrderId &&
          !(await tx.serviceOrder.findFirst({
            where: { id: values.serviceOrderId, orgId },
            select: { id: true },
          }))
        )
          throw new NotFoundException("O.S. não encontrada nesta empresa");
        if (
          !(await tx.inventoryProduct.findFirst({
            where: { id: values.productId, orgId },
            select: { id: true },
          }))
        )
          throw new NotFoundException("Produto não encontrado nesta empresa");
        const changed = await tx.inventoryProduct.updateMany({
          where: {
            id: values.productId,
            orgId,
            onHand:
              input.direction === "OUT"
                ? { gte: input.quantity }
                : { lte: 2147483647 - input.quantity },
          },
          data: {
            onHand: {
              increment:
                input.direction === "IN" ? input.quantity : -input.quantity,
            },
          },
        });
        if (changed.count !== 1)
          throw new BadRequestException(
            "Saldo insuficiente ou limite de estoque excedido",
          );
        return tx.stockMovement.create({
          data: { ...values, orgId, actorUserId, entryKey: input.entryKey },
        });
      });
    } catch (error) {
      // A competing identical request may have committed while this transaction waited.
      const saved = await this.db.stockMovement.findUnique({
        where: { orgId_entryKey: { orgId, entryKey: input.entryKey } },
      });
      if (saved) return this.same(saved, values);
      throw error;
    }
  }
  async fiscalDrafts(orgId: string) {
    const items = await this.db.fiscalDraft.findMany({
      where: { orgId },
      include: { customer: { select: { name: true, cpfCnpj: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    });
    return { emissionAvailable: false as const, items };
  }
  async createFiscalDraft(
    orgId: string,
    actorUserId: string,
    input: FiscalDraftDto,
  ) {
    const values = {
      customerId: input.customerId,
      serviceOrderId: input.serviceOrderId || null,
      description: input.description.trim(),
      amountCents: input.amountCents,
      currency: input.expectedCurrency,
    };
    const saved = await this.db.fiscalDraft.findUnique({
      where: { orgId_entryKey: { orgId, entryKey: input.entryKey } },
    });
    if (saved) return this.same(saved, values);
    if (values.description.length < 5)
      throw new BadRequestException("Descreva o serviço");
    if (
      !(await this.db.customer.findFirst({
        where: { id: input.customerId, orgId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Cliente não encontrado nesta empresa");
    if (
      values.serviceOrderId &&
      !(await this.db.serviceOrder.findFirst({
        where: {
          id: values.serviceOrderId,
          orgId,
          customerId: values.customerId,
        },
        select: { id: true },
      }))
    )
      throw new NotFoundException("O.S. não pertence ao cliente desta empresa");
    const { currency } = await this.organization(orgId);
    if (currency !== input.expectedCurrency)
      throw new ConflictException(
        "A moeda da empresa mudou. Atualize a página antes de salvar.",
      );
    try {
      return await this.db.fiscalDraft.create({
        data: {
          ...values,
          currency,
          orgId,
          actorUserId,
          entryKey: input.entryKey,
        },
      });
    } catch (error: any) {
      if (error.code !== "P2002") throw error;
      const existing = await this.db.fiscalDraft.findUnique({
        where: { orgId_entryKey: { orgId, entryKey: input.entryKey } },
      });
      if (!existing) throw error;
      return this.same(existing, values);
    }
  }
  async recordExpense(
    orgId: string,
    actorUserId: string,
    input: RecordedExpenseDto,
  ) {
    const values = {
      title: input.title.trim(),
      amountCents: input.amountCents,
      occurredAt: new Date(input.occurredAt).toISOString(),
      currency: input.expectedCurrency,
    };
    const saved = await this.db.expense.findUnique({
      where: { orgId_entryKey: { orgId, entryKey: input.entryKey } },
    });
    if (saved) return this.same(saved, values);
    if (values.title.length < 2)
      throw new BadRequestException("Informe a descrição da despesa");
    const { currency } = await this.organization(orgId);
    if (currency !== input.expectedCurrency)
      throw new ConflictException(
        "A moeda da empresa mudou. Atualize a página antes de salvar.",
      );
    try {
      return await this.db.expense.create({
        data: {
          ...values,
          currency,
          orgId,
          entryKey: input.entryKey,
          createdByUserId: actorUserId,
          category: "OPERATIONS",
          type: "VARIABLE",
          recurrence: "NONE",
        },
      });
    } catch (error: any) {
      if (error.code !== "P2002") throw error;
      const existing = await this.db.expense.findUnique({
        where: { orgId_entryKey: { orgId, entryKey: input.entryKey } },
      });
      if (!existing) throw error;
      return this.same(existing, values);
    }
  }
  async classifyExpenseCurrency(orgId: string, id: string, currency: string) {
    const expense = await this.db.expense.findFirst({ where: { id, orgId } });
    if (!expense)
      throw new NotFoundException("Despesa não encontrada nesta empresa");
    if (expense.currency && expense.currency !== currency)
      throw new ConflictException(
        "A moeda já foi definida. O valor não será convertido.",
      );
    await this.db.expense.updateMany({
      where: { id, orgId, currency: null },
      data: { currency },
    });
    const current = await this.db.expense.findFirst({ where: { id, orgId } });
    if (!current || current.currency !== currency)
      throw new ConflictException(
        "A moeda foi definida por outra operação. Atualize a consulta.",
      );
    return current;
  }
  async health(orgId: string, month?: string) {
    const org = await this.organization(orgId);
    let range: ReturnType<typeof zonedMonthBounds>;
    try {
      range = zonedMonthBounds(org.timezone, month);
    } catch {
      throw new BadRequestException("Mês inválido. Use AAAA-MM.");
    }
    const period = { gte: range.start, lt: range.end };
    const [payments, refunds, expenses, charges] = await Promise.all([
      this.db.payment.findMany({
        where: { orgId, paidAt: period, charge: { orgId } },
        select: { amountCents: true, charge: { select: { currency: true } } },
      }),
      this.db.paymentRefund.findMany({
        where: { orgId, refundedAt: period, reversedAt: null },
        select: { amountCents: true, currency: true },
      }),
      this.db.expense.findMany({
        where: {
          orgId,
          OR: [
            { recurrence: "NONE", occurredAt: period },
            {
              recurrence: "MONTHLY",
              isActive: true,
              occurredAt: { lt: range.end },
            },
          ],
        },
        select: {
          id: true,
          title: true,
          amountCents: true,
          currency: true,
          occurredAt: true,
          recurrence: true,
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      }),
      this.db.charge.findMany({
        where: { orgId, status: { in: ["PENDING", "OVERDUE"] } },
        select: {
          currency: true,
          amountCents: true,
          status: true,
          payments: {
            select: {
              amountCents: true,
              refunds: {
                where: { reversedAt: null },
                select: { amountCents: true },
              },
            },
          },
        },
      }),
    ]);
    const rows = new Map<
      string,
      {
        currency: string;
        receivedCents: number;
        refundedCents: number;
        expensesCents: number;
        openCents: number;
        overdueCents: number;
      }
    >();
    const row = (currency: string) => {
      const key = currency.toUpperCase();
      if (!rows.has(key))
        rows.set(key, {
          currency: key,
          receivedCents: 0,
          refundedCents: 0,
          expensesCents: 0,
          openCents: 0,
          overdueCents: 0,
        });
      return rows.get(key)!;
    };
    row(org.currency);
    for (const p of payments)
      row(p.charge.currency).receivedCents += p.amountCents;
    for (const r of refunds) row(r.currency).refundedCents += r.amountCents;
    for (const e of expenses)
      if (e.currency) row(e.currency).expensesCents += e.amountCents;
    for (const c of charges) {
      const paid = c.payments.reduce(
        (sum, p) =>
          sum +
          p.amountCents -
          p.refunds.reduce((s, r) => s + r.amountCents, 0),
        0,
      );
      const remaining = Math.max(0, c.amountCents - paid);
      row(c.currency).openCents += remaining;
      if (c.status === "OVERDUE") row(c.currency).overdueCents += remaining;
    }
    const unclassifiedExpenseCount = expenses.filter((e) => !e.currency).length;
    return {
      month: range.month,
      timezone: org.timezone,
      unclassifiedExpenseCount,
      recentExpenses: [
        ...expenses.filter((e) => !e.currency),
        ...expenses.filter((e) => e.currency),
      ].slice(0, 50),
      currencies: [...rows.values()].map((r) => ({
        ...r,
        recordedResultCents: unclassifiedExpenseCount
          ? null
          : r.receivedCents - r.refundedCents - r.expensesCents,
      })),
    };
  }
}
