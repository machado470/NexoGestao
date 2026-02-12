export type TrackRule = {
  maxAttempts: number
  certificateEnabled: boolean
}

export type Track = {
  id: string
  title: string
  description: string
  rule: TrackRule
}
