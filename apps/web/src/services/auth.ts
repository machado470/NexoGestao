import api from './api'

export async function activateAccount(input: { token: string; password: string }) {
  const { data } = await api.post('/auth/activate', input)
  return data
}
