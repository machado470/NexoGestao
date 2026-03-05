import { MemoryCacheService } from './memory-cache.service'

describe('MemoryCacheService', () => {
  let service: MemoryCacheService

  beforeEach(() => {
    service = new MemoryCacheService()
  })

  describe('set e get', () => {
    it('deve armazenar e recuperar um valor', () => {
      service.set('key1', { data: 'test' }, 60000)
      const result = service.get<{ data: string }>('key1')
      expect(result).toEqual({ data: 'test' })
    })

    it('deve retornar null para chave inexistente', () => {
      const result = service.get('non-existent')
      expect(result).toBeNull()
    })

    it('deve retornar null para valor expirado', async () => {
      service.set('expired-key', 'value', 1) // 1ms TTL
      await new Promise((r) => setTimeout(r, 10))
      const result = service.get('expired-key')
      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('deve remover uma chave específica', () => {
      service.set('key1', 'value1', 60000)
      service.delete('key1')
      expect(service.get('key1')).toBeNull()
    })
  })

  describe('deleteByPrefix', () => {
    it('deve remover todas as chaves com o prefixo', () => {
      service.set('dashboard:metrics:org-1', 'v1', 60000)
      service.set('dashboard:alerts:org-1', 'v2', 60000)
      service.set('other:key', 'v3', 60000)

      service.deleteByPrefix('dashboard:')

      expect(service.get('dashboard:metrics:org-1')).toBeNull()
      expect(service.get('dashboard:alerts:org-1')).toBeNull()
      expect(service.get('other:key')).toBe('v3')
    })
  })

  describe('getOrSet', () => {
    it('deve executar a função e armazenar o resultado', async () => {
      const fn = jest.fn().mockResolvedValue({ computed: true })

      const result = await service.getOrSet('key1', fn, 60000)

      expect(result).toEqual({ computed: true })
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('deve usar o cache na segunda chamada', async () => {
      const fn = jest.fn().mockResolvedValue({ computed: true })

      await service.getOrSet('key1', fn, 60000)
      await service.getOrSet('key1', fn, 60000)

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('deve recalcular após expiração', async () => {
      const fn = jest.fn().mockResolvedValue({ computed: true })

      await service.getOrSet('key1', fn, 1) // 1ms TTL
      await new Promise((r) => setTimeout(r, 10))
      await service.getOrSet('key1', fn, 1)

      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('clear', () => {
    it('deve limpar todo o cache', () => {
      service.set('key1', 'v1', 60000)
      service.set('key2', 'v2', 60000)

      service.clear()

      expect(service.get('key1')).toBeNull()
      expect(service.get('key2')).toBeNull()
    })
  })
})
