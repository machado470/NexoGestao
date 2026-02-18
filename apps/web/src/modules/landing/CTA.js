import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/ThemeProvider';
export default function CTA() {
    const { styles } = useTheme();
    return (_jsxs("section", { className: "relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 -z-10 bg-gradient-to-b from-black via-slate-950 to-slate-950" }), _jsx("div", { className: "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(249,115,22,0.18),transparent_45%)]" }), _jsx(SectionBase, { children: _jsx("div", { className: "max-w-5xl mx-auto px-6 py-40", children: _jsxs(Card, { className: "\n              relative p-16\n              bg-slate-900/80\n              backdrop-blur\n              border border-white/10\n              shadow-2xl shadow-black/40\n              text-center\n            ", children: [_jsxs("h2", { className: "text-3xl md:text-4xl font-semibold text-white leading-tight", children: ["Governan\u00E7a n\u00E3o se promete.", _jsx("br", {}), _jsx("span", { className: "text-[#F97316]", children: "Ela se executa." })] }), _jsx("p", { className: "mt-6 text-lg text-slate-300 max-w-2xl mx-auto", children: "Veja o NexoGestao operando em um ambiente real ou entre diretamente no sistema se voc\u00EA j\u00E1 possui acesso." }), _jsxs("div", { className: "mt-14 flex flex-col sm:flex-row items-center justify-center gap-4", children: [_jsx("a", { href: "#", className: `
                  px-10 py-4 rounded-xl
                  ${styles.buttonPrimary}
                  transition-all duration-200
                  shadow-lg shadow-black/25
                `, children: "Solicitar acesso guiado" }), _jsx(Link, { to: "/login", className: `
                  px-10 py-4 rounded-xl
                  ${styles.border}
                  ${styles.textPrimary}
                  hover:bg-white/5
                  transition-all duration-200
                `, children: "Entrar no sistema" })] }), _jsx("p", { className: "mt-8 text-sm text-slate-400", children: "Sem compromisso comercial. Sem press\u00E3o. Apenas uma vis\u00E3o clara do funcionamento." })] }) }) })] }));
}
