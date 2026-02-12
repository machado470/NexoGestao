import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function Onboarding() {
  const navigate = useNavigate()

  async function handleComplete() {
    // conclui onboarding no backend
    await api.post('/onboarding/complete')

    // força revalidação do estado global
    await api.get('/me')

    // agora sim pode ir pro admin
    navigate('/admin')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        backgroundColor: '#020617',
        color: 'white',
      }}
    >
      <h1>Onboarding inicial</h1>
      <p>Configuração obrigatória da organização</p>

      <button
        onClick={handleComplete}
        style={{
          padding: '12px 24px',
          fontSize: 16,
          cursor: 'pointer',
        }}
      >
        Concluir onboarding
      </button>
    </div>
  )
}
