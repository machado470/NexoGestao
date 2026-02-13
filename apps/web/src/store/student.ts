import { create } from 'zustand'

export type StudentUser = {
  id: string
  name: string
  email?: string
} | null

export type StudentPhase = {
  id: string
  title: string
  status?: string
}

type StudentState = {
  user: StudentUser
  phases: StudentPhase[]
  setData: (data: { user: StudentUser; phases: StudentPhase[] }) => void
}

export const useStudentStore = create<StudentState>(set => ({
  user: null,
  phases: [],

  setData: data =>
    set({
      user: data.user,
      phases: data.phases,
    }),
}))
