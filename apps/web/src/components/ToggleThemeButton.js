import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../theme/useTheme';
export default function ToggleThemeButton() {
    const { theme, toggleTheme } = useTheme();
    // ✅ Tema claro = offwhite
    const isLight = theme === 'offwhite';
    return (_jsx("button", { onClick: toggleTheme, "aria-label": "Alternar tema", className: "\n        p-2 rounded-md\n        text-slate-400 hover:text-white\n        hover:bg-white/5\n        transition-colors\n      ", children: isLight ? (
        // Moon icon (modo escuro)
        _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" }) })) : (
        // Sun icon (modo claro)
        _jsxs("svg", { xmlns: "http://www.w3.org/2000/svg", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "4" }), _jsx("line", { x1: "12", y1: "2", x2: "12", y2: "6" }), _jsx("line", { x1: "12", y1: "18", x2: "12", y2: "22" }), _jsx("line", { x1: "4.93", y1: "4.93", x2: "7.76", y2: "7.76" }), _jsx("line", { x1: "16.24", y1: "16.24", x2: "19.07", y2: "19.07" }), _jsx("line", { x1: "2", y1: "12", x2: "6", y2: "12" }), _jsx("line", { x1: "18", y1: "12", x2: "22", y2: "12" }), _jsx("line", { x1: "4.93", y1: "19.07", x2: "7.76", y2: "16.24" }), _jsx("line", { x1: "16.24", y1: "7.76", x2: "19.07", y2: "4.93" })] })) }));
}
