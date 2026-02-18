import { jsx as _jsx } from "react/jsx-runtime";
export default function Skeleton({ className }) {
    return (_jsx("div", { className: `
        animate-pulse
        rounded-lg
        bg-black/10 dark:bg-white/10
        ${className ?? ''}
      ` }));
}
