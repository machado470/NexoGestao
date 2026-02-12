export type QuizOption = {
  id: string
  text: string
  correct: boolean
}

export type Quiz = {
  id: string
  lessonId: string
  question: string
  options: QuizOption[]
}
