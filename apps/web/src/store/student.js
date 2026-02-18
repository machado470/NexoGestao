import { create } from 'zustand';
export const useStudentStore = create(set => ({
    user: null,
    phases: [],
    setData: data => set({
        user: data.user,
        phases: data.phases,
    }),
}));
