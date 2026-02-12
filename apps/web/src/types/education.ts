export type Track = {
  id: string
  title: string
  progress: number
}

export type Lesson = {
  id: string
  trackId: string
  title: string
  content: string
  completed: boolean
}
