import { create } from 'zustand';
export const useQuizStore = create(set => ({
    quizId: null,
    questions: [],
    current: 0,
    answers: [],
    setQuiz: (id, questions) => set({ quizId: id, questions, current: 0, answers: [] }),
    answer: (questionId, selected) => set(state => ({
        answers: [...state.answers, { questionId, selected }],
    })),
    next: () => set(state => ({
        current: Math.min(state.current + 1, state.questions.length - 1),
    })),
    reset: () => set({
        quizId: null,
        questions: [],
        current: 0,
        answers: [],
    }),
}));
