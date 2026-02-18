import { jsx as _jsx } from "react/jsx-runtime";
export default function Avatar({ name, className = 'w-7 h-7', }) {
    const initial = name?.trim()?.charAt(0)?.toUpperCase() ?? '?';
    return (_jsx("div", { className: `
        ${className}
        rounded-full
        bg-indigo-500/20
        text-indigo-300
        flex items-center justify-center
        text-sm font-semibold
        select-none
      `, "aria-label": "Avatar do usu\u00E1rio", children: initial }));
}
