import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/ThemeProvider';
export default function FeatureCard({ icon, eyebrow, title, children, }) {
    const { styles } = useTheme();
    return (_jsxs("div", { className: "\n        group relative h-full\n        rounded-2xl\n        border border-white/10\n        bg-white/[0.04]\n        backdrop-blur-xl\n        p-10\n        transition-all duration-300\n        hover:-translate-y-1\n        hover:border-white/20\n      ", children: [_jsx("div", { className: "\n          pointer-events-none\n          absolute inset-0\n          rounded-2xl\n          bg-[radial-gradient(circle_at_25%_15%,rgba(249,115,22,0.22),transparent_55%)]\n          opacity-0\n          group-hover:opacity-100\n          transition-opacity duration-300\n        " }), _jsxs("div", { className: "relative z-10 flex flex-col gap-5", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: `
              w-12 h-12
              ${styles.accent}
              transition-transform duration-300
              group-hover:scale-110
            `, children: icon }), eyebrow && (_jsx("span", { className: `text-xs uppercase tracking-wider ${styles.textMuted}`, children: eyebrow }))] }), _jsx("h3", { className: "text-lg font-medium text-white", children: title }), _jsx("p", { className: "text-sm text-slate-400 leading-relaxed", children: children })] })] }));
}
