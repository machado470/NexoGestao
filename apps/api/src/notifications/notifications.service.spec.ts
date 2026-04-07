import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'

const mockQueueService = {
  addJob: jest.fn(),
}

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
}

describe('NotificationsService', () => {
  let service: NotificationsService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueueService },
      ],
    }).compile()

    service = module.get<NotificationsService>(NotificationsService)
    jest.clearAllMocks()
  })

  it('deve incluir notificações globais da organização no feed do usuário', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([])

    await service.getNotifications('org-1', 'user-1')

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orgId: 'org-1',
          OR: [{ userId: 'user-1' }, { userId: null }],
        },
      }),
    )
  })

  it('deve contar apenas notificações não lidas visíveis para o usuário', async () => {
    mockPrisma.notification.count.mockResolvedValue(3)

    const result = await service.getUnreadCount('org-1', 'user-1')

    expect(result).toBe(3)
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({
      where: {
        orgId: 'org-1',
        readAt: null,
        OR: [{ userId: 'user-1' }, { userId: null }],
      },
    })
  })

  it('deve impedir marcar notificação de outro tenant como lida', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 })

    await expect(service.markAsRead('org-1', 'user-1', 'notif-1')).rejects.toThrow(
      NotFoundException,
    )
  })

  it('deve marcar como lida quando notificação pertence ao tenant do usuário', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 })

    const result = await service.markAsRead('org-1', 'user-1', 'notif-1')

    expect(result).toEqual({ ok: true })
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'notif-1',
          orgId: 'org-1',
          OR: [{ userId: 'user-1' }, { userId: null }],
        },
      }),
    )
  })

  it('deve marcar todas como lidas e retornar total atualizado', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 4 })

    const result = await service.markAllAsRead('org-1', 'user-1')

    expect(result).toEqual({ ok: true, updated: 4 })
  })
})
