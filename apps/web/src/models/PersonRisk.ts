export type RiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type PersonRisk = {
  personId: string
  name: string
  email?: string
  risk: RiskLevel
  progress: number
}
