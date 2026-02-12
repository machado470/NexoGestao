export type User = {
  id: string
  name: string
  email: string
  role: 'STUDENT' | 'ADMIN'
}

export type Lesson = {
  id: string
  title: string
}

export type Phase = {
  id: string
  name: string
  lessons: Lesson[]
}

export type Category = {
  id: string
  name: string
  phases: Phase[]
}

export type StudentDashboardResponse = {
  user: User
  categories: Category[]
}
