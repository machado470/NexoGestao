import api from './api'

export async function getMe() {
  const { data } = await api.get('/me')
  return data
}
