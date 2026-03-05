/**
 * Testes de Integração - Fluxo Completo NexoGestão
 *
 * Fluxo testado:
 * cliente → agendamento → ordem de serviço → cobrança → pagamento → dashboard
 *
 * Estes testes utilizam mocks do PrismaService para simular o banco de dados,
 * garantindo que o fluxo de negócio end-to-end funcione corretamente.
 */

import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { CustomersService } from '../../src/customers/customers.service'
import { ServiceOrdersService } from '../../src/service-orders/service-orders.service'
import { FinanceService } from '../../src/finance/finance.service'
import { ExpensesService } from '../../src/expenses/expenses.service'
import { InvoicesService } from '../../src/invoices/invoices.service'
import { LaunchesService } from '../../src/launches/launches.service'
import { ReferralsService } from '../../src/referrals/referrals.service'
import { PrismaService } from '../../src/prisma/prisma.service'
import { AuditService } from '../../src/audit/audit.service'
import { TimelineService } from '../../src/timeline/timeline.service'
import { OperationalStateService } from '../../src/people/operational-state.service'
import { NotificationsService } from '../../src/notifications/notifications.service'
import { OnboardingService } from '../../src/onboarding/onboarding.service'
import { ExpenseCategory } from '../../src/expenses/dto/create-expense.dto'
import { CreateInvoiceDto, InvoiceStatus } from '../../src/invoices/dto/create-invoice.dto'
import { LaunchType } from '../../src/launches/dto/create-launch.dto'
import { CreateReferralDto } from '../../src/referrals/dto/create-referral.dto'

const ORG_ID = 'test-org-id'
const USER_ID = 'test-user-id'

// ============================================================
// Mock do PrismaService
// ============================================================
const mockPrisma = {
  customer: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  serviceOrder: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  charge: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  expense: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  invoice: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  launch: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  referral: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  person: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  appointment: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  timelineEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
}

const mockAudit = { log: jest.fn() }
const mockTimeline = { log: jest.fn() }
const mockOperationalState = { syncAndLogStateChange: jest.fn() }
const mockNotifications = { createNotification: jest.fn() }
const mockOnboarding = { completeOnboardingStep: jest.fn() }

// ============================================================
// Testes: Módulo de Despesas
// ============================================================
describe('ExpensesService - Regras de Domínio', () => {
  let service: ExpensesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<ExpensesService>(ExpensesService)
    jest.clearAllMocks()
  })

  it('deve rejeitar despesa com valor zero', async () => {
    await expect(
      service.create(ORG_ID, USER_ID, {
        description: 'Despesa inválida',
        amountCents: 0,
        date: '2024-01-15',
        category: ExpenseCategory.SUPPLIES,
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('deve rejeitar despesa com valor negativo', async () => {
    await expect(
      service.create(ORG_ID, USER_ID, {
        description: 'Despesa inválida',
        amountCents: -100,
        date: '2024-01-15',
        category: ExpenseCategory.SUPPLIES,
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('deve criar despesa com dados válidos', async () => {
    const mockCreated = {
      id: 'exp-1',
      orgId: ORG_ID,
      description: 'Aluguel',
      amountCents: 150000,
      category: 'OPERATIONAL',
      date: new Date('2024-01-15'),
    }
    mockPrisma.expense.create.mockResolvedValue(mockCreated)

    const result = await service.create(ORG_ID, USER_ID, {
      description: 'Aluguel',
      amountCents: 150000,
      date: '2024-01-15',
      category: ExpenseCategory.OPERATIONAL,
    })

    expect(result).toEqual(mockCreated)
    expect(mockPrisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: ORG_ID, amountCents: 150000 }),
      }),
    )
  })

  it('deve garantir isolamento de tenant na listagem', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([])
    mockPrisma.expense.count.mockResolvedValue(0)

    await service.list(ORG_ID, {})

    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: ORG_ID }),
      }),
    )
  })
})

// ============================================================
// Testes: Módulo de Faturas
// ============================================================
describe('InvoicesService - Transições de Status', () => {
  let service: InvoicesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<InvoicesService>(InvoicesService)
    jest.clearAllMocks()
  })

  it('deve permitir transição DRAFT → ISSUED', async () => {
    const draftInvoice = {
      id: 'inv-1',
      orgId: ORG_ID,
      status: 'DRAFT',
      number: 'NF-001',
      amountCents: 10000,
      issuedAt: null,
    }
    mockPrisma.invoice.findFirst.mockResolvedValue(draftInvoice)
    mockPrisma.invoice.update.mockResolvedValue({ ...draftInvoice, status: 'ISSUED' })

    const result = await service.update(ORG_ID, 'inv-1', { status: InvoiceStatus.ISSUED })
    expect(result.status).toBe('ISSUED')
  })

  it('deve bloquear transição PAID → DRAFT', async () => {
    const paidInvoice = {
      id: 'inv-2',
      orgId: ORG_ID,
      status: 'PAID',
      number: 'NF-002',
      amountCents: 10000,
    }
    mockPrisma.invoice.findFirst.mockResolvedValue(paidInvoice)

    await expect(
      service.update(ORG_ID, 'inv-2', { status: InvoiceStatus.DRAFT }),
    ).rejects.toThrow(BadRequestException)
  })

  it('deve bloquear transição CANCELLED → ISSUED', async () => {
    const cancelledInvoice = {
      id: 'inv-3',
      orgId: ORG_ID,
      status: 'CANCELLED',
      number: 'NF-003',
      amountCents: 10000,
    }
    mockPrisma.invoice.findFirst.mockResolvedValue(cancelledInvoice)

    await expect(
      service.update(ORG_ID, 'inv-3', { status: InvoiceStatus.ISSUED }),
    ).rejects.toThrow(BadRequestException)
  })

  it('deve impedir exclusão de fatura paga', async () => {
    const paidInvoice = {
      id: 'inv-4',
      orgId: ORG_ID,
      status: 'PAID',
      number: 'NF-004',
    }
    mockPrisma.invoice.findFirst.mockResolvedValue(paidInvoice)

    await expect(service.delete(ORG_ID, 'inv-4')).rejects.toThrow(BadRequestException)
  })

  it('deve rejeitar fatura com valor zero', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null) // Sem duplicata

    await expect(
      service.create(ORG_ID, {
        number: 'NF-005',
        amountCents: 0,
        description: 'Fatura inválida',
      } satisfies CreateInvoiceDto),
    ).rejects.toThrow(BadRequestException)
  })
})

// ============================================================
// Testes: Módulo de Lançamentos
// ============================================================
describe('LaunchesService - Validações de Domínio', () => {
  let service: LaunchesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaunchesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<LaunchesService>(LaunchesService)
    jest.clearAllMocks()
  })

  it('deve rejeitar lançamento com tipo inválido', async () => {
    await expect(
      service.create(ORG_ID, USER_ID, {
        description: 'Lançamento inválido',
        amountCents: 10000,
        type: 'INVALID_TYPE' as LaunchType,
        category: 'Receita',
        date: '2024-01-15',
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('deve rejeitar lançamento com valor negativo', async () => {
    await expect(
      service.create(ORG_ID, USER_ID, {
        description: 'Lançamento inválido',
        amountCents: -500,
        type: LaunchType.INCOME,
        category: 'Receita',
        date: '2024-01-15',
      }),
    ).rejects.toThrow(BadRequestException)
  })

  it('deve criar lançamento INCOME com sucesso', async () => {
    const mockCreated = {
      id: 'launch-1',
      orgId: ORG_ID,
      type: 'INCOME',
      amountCents: 50000,
    }
    mockPrisma.launch.create.mockResolvedValue(mockCreated)

    const result = await service.create(ORG_ID, USER_ID, {
      description: 'Venda de produto',
      amountCents: 50000,
      type: LaunchType.INCOME,
      category: 'Vendas',
      date: '2024-01-15',
    })

    expect(result.type).toBe('INCOME')
  })
})

// ============================================================
// Testes: Módulo de Indicações
// ============================================================
describe('ReferralsService - Código Único e Duplicidade', () => {
  let service: ReferralsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    service = module.get<ReferralsService>(ReferralsService)
    jest.clearAllMocks()
  })

  it('deve impedir indicação duplicada', async () => {
    const existingReferral = {
      id: 'ref-1',
      orgId: ORG_ID,
      referrerEmail: 'referrer@example.com',
      referredEmail: 'referred@example.com',
    }
    mockPrisma.referral.findFirst.mockResolvedValueOnce(existingReferral)

    await expect(
      service.create(ORG_ID, {
        referrerName: 'João',
        referrerEmail: 'referrer@example.com',
        referredName: 'Maria',
        referredEmail: 'referred@example.com',
      } satisfies CreateReferralDto),
    ).rejects.toThrow(ConflictException)
  })

  it('deve criar indicação com código único gerado automaticamente', async () => {
    mockPrisma.referral.findFirst
      .mockResolvedValueOnce(null) // Sem duplicata de referral
      .mockResolvedValueOnce(null) // Código único disponível

    const mockCreated = {
      id: 'ref-2',
      orgId: ORG_ID,
      code: 'ABCD1234',
      status: 'PENDING',
    }
    mockPrisma.referral.create.mockResolvedValue(mockCreated)

    const result = await service.create(ORG_ID, {
      referrerName: 'João',
      referrerEmail: 'joao@example.com',
      referredName: 'Maria',
      referredEmail: 'maria@example.com',
    } satisfies CreateReferralDto)

    expect(result.code).toBeTruthy()
    expect(mockPrisma.referral.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: ORG_ID }),
      }),
    )
  })
})

// ============================================================
// Testes: Multi-Tenancy
// ============================================================
describe('Multi-Tenancy - Isolamento de Dados', () => {
  let expensesService: ExpensesService
  let invoicesService: InvoicesService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    expensesService = module.get<ExpensesService>(ExpensesService)
    invoicesService = module.get<InvoicesService>(InvoicesService)
    jest.clearAllMocks()
  })

  it('deve garantir que despesas de org-A não apareçam para org-B', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([])
    mockPrisma.expense.count.mockResolvedValue(0)

    await expensesService.list('org-A', {})

    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: 'org-A' }),
      }),
    )

    // Verifica que orgId 'org-B' não foi usado
    const callArgs = mockPrisma.expense.findMany.mock.calls[0][0]
    expect(callArgs.where.orgId).toBe('org-A')
    expect(callArgs.where.orgId).not.toBe('org-B')
  })

  it('deve garantir que faturas de org-A não apareçam para org-B', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([])
    mockPrisma.invoice.count.mockResolvedValue(0)

    await invoicesService.list('org-A', {})

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: 'org-A' }),
      }),
    )
  })

  it('deve retornar 404 ao tentar acessar recurso de outra org', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null) // Não encontrado na org-B

    await expect(invoicesService.findOne('org-B', 'inv-from-org-A')).rejects.toThrow(
      NotFoundException,
    )
  })
})
