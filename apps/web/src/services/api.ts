import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')

  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  response => {
    const d = response.data

    // ✅ padroniza: se backend respondeu { ok: true, data }, retorna só o data
    if (d && typeof d === 'object' && d.ok === true && 'data' in d) {
      return { ...response, data: (d as any).data }
    }

    return response
  },
  error => {
    const hadToken = !!localStorage.getItem('access_token')

    if (error.response?.status === 401 && hadToken) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }

    return Promise.reject(error)
  },
)

export default api
