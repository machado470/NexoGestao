import { create } from "zustand";
import { persist } from "zustand/middleware";
const useAuth = create()(persist((set) => ({
    token: null,
    role: null,
    login: (token, role) => {
        set({ token, role });
    },
    logout: () => {
        set({ token: null, role: null });
    },
}), {
    name: "auth-storage",
}));
export default useAuth;
