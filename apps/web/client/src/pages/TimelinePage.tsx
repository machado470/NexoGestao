import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export default function TimelinePage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [customerId, setCustomerId] = useState<string>('')
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    api.listCustomers().then((data: any) => {
      setCustomers(data || [])
      if (data?.[0]?.id) setCustomerId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!customerId) return
    api.getCustomerTimeline(customerId, 100).then((res: any) => {
      setEvents(res?.data ?? [])
    })
  }, [customerId])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Timeline do Cliente</h1>
      <select className="border rounded px-3 py-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
        {customers.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
      </select>
      <div className="space-y-2">
        {events.map((e: any) => (
          <div key={e.id} className="border rounded p-3">
            <div className="font-medium">{e.action}</div>
            <div className="text-sm text-gray-500">{new Date(e.createdAt).toLocaleString('pt-BR')}</div>
            <pre className="text-xs overflow-auto">{JSON.stringify(e.metadata, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}
