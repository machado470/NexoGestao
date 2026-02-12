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
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          'Erro ao enviar avaliação',
      )
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
