import { create } from 'zustand'

export type QuizQuestion = {
  id: string
  statement: string
  alternatives: string[]
}

export type Answer = {
  questionId: string
  selected: string
}

type QuizState = {
  quizId: string | null
  questions: QuizQuestion[]
  current: number
  answers: Answer[]

  setQuiz: (id: string, questions: QuizQuestion[]) => void
  answer: (questionId: string, selected: string) => void
  next: () => void
  reset: () => void
}

export const useQuizStore = create<QuizState>(set => ({
  quizId: null,
  questions: [],
  current: 0,
  answers: [],

  setQuiz: (id, questions) =>
    set({ quizId: id, questions, current: 0, answers: [] }),

  answer: (questionId, selected) =>
    set(state => ({
      answers: [...state.answers, { questionId, selected }],
    })),

  next: () =>
    set(state => ({
      current: Math.min(state.current + 1, state.questions.length - 1),
    })),

  reset: () =>
    set({
      quizId: null,
      questions: [],
      current: 0,
      answers: [],
    }),
}))
