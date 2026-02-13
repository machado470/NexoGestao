import api from './api'

export async function activateAccount(input: { token: string; password: string }) {
  const res = await api.post('/auth/activate', input)
  return res.data
}
