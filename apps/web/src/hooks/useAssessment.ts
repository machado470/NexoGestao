import { useState } from 'react'
import api from '../services/api'

type AssessmentResult = {
  assessment: {
    id: string
    score: number
    risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  }
  feedback: {
    score: number
    educationalRisk: 'LOW' | 'MEDIUM' | 'HIGH'
    operationalRiskScore: number
    message: string
    nextStep: string
  }
}

function getErrorMessage(err: unknown): string {
  if (typeof err !== 'object' || err === null) {
    return 'Erro ao enviar avaliação'
  }

  const anyErr = err as {
    response?: { data?: { error?: { message?: string } } }
    message?: string
  }

  return (
    anyErr.response?.data?.error?.message ??
    anyErr.message ??
    'Erro ao enviar avaliação'
  )
}

export default function useAssessment() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submitAssessment(params: {
    assignmentId: string
    score: number
    notes?: string
  }): Promise<AssessmentResult> {
    try {
      setLoading(true)
      setError(null)

      const res = await api.post('/assessments', params)
      return res.data.data
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    submitAssessment,
    loading,
    error,
  }
}
