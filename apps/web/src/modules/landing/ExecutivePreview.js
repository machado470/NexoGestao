import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/ThemeProvider';
const kpis = [
    {
        label: 'Risco humano',
        value: 'ALTO',
        hint: 'Baseado em execução, atraso e recorrência',
    },
    {
        label: 'Conformidade',
        value: '54%',
        hint: 'Aderência média às trilhas ativas',
    },
    {
        label: 'Ações pendentes',
        value: '12',
        hint: 'Ações corretivas exigidas pelo sistema',
    },
];
export default function ExecutivePreview() {
    const { styles } = useTheme();
    return (_jsxs("section", { className: "relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-black to-black" }), _jsx("div", { className: "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_70%_30%,rgba(249,115,22,0.14),transparent_45%)]" }), _jsx(SectionBase, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-32", children: [_jsxs("div", { className: "max-w-3xl mb-24", children: [_jsx("span", { className: `
                inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full
                ${styles.border}
                ${styles.textMuted}
                ${styles.surface}
              `, children: "Vis\u00E3o executiva" }), _jsxs("h2", { className: "text-3xl md:text-4xl font-semibold text-white leading-tight", children: ["Decis\u00E3o orientada por dados.", _jsx("br", {}), _jsx("span", { className: "text-[#F97316]", children: "N\u00E3o por sensa\u00E7\u00E3o." })] }), _jsx("p", { className: "mt-6 text-lg text-slate-300", children: "O painel executivo consolida risco humano, conformidade e a\u00E7\u00F5es corretivas em um \u00FAnico lugar \u2014 com base em dados operacionais reais." })] }), _jsx("div", { className: "grid gap-8 lg:grid-cols-3", children: kpis.map(k => (_jsxs(Card, { className: "\n                  relative p-10\n                  bg-slate-900/70\n                  backdrop-blur\n                  border border-white/10\n                  transition-all duration-300\n                  hover:-translate-y-1\n                  hover:shadow-2xl hover:shadow-black/40\n                ", children: [_jsx("div", { className: "text-xs uppercase tracking-wider text-slate-400", children: k.label }), _jsx("div", { className: "mt-4 text-3xl font-semibold text-white", children: k.value }), _jsx("div", { className: "mt-3 text-sm text-slate-300", children: k.hint }), _jsx("div", { className: "absolute inset-0 pointer-events-none rounded-2xl bg-[#F97316]/5 opacity-0 hover:opacity-100 transition" })] }, k.label))) }), _jsx("div", { className: "mt-12", children: _jsxs(Card, { className: "\n                relative p-10\n                bg-slate-900/70\n                backdrop-blur\n                border border-white/10\n                transition-all duration-300\n                hover:shadow-2xl hover:shadow-black/40\n              ", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("div", { className: "text-sm uppercase tracking-wider text-slate-400", children: "Tend\u00EAncia de risco" }), _jsx("div", { className: "text-xs text-[#F97316]", children: "\u00DAltimos 90 dias" })] }), _jsxs("svg", { viewBox: "0 0 600 200", className: "w-full h-40", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "exec-line", x1: "0", y1: "0", x2: "1", y2: "0", children: [_jsx("stop", { offset: "0%", stopColor: "rgba(249,115,22,0.25)" }), _jsx("stop", { offset: "100%", stopColor: "rgba(249,115,22,1)" })] }) }), _jsx("polyline", { fill: "none", stroke: "url(#exec-line)", strokeWidth: "3", points: "\n                    0,140\n                    80,130\n                    160,120\n                    240,135\n                    320,110\n                    400,95\n                    480,85\n                    560,75\n                  " })] }), _jsx("p", { className: "mt-4 text-sm text-slate-300", children: "Tend\u00EAncia ascendente indica aumento de risco por recorr\u00EAncia de atrasos e falhas de execu\u00E7\u00E3o." })] }) }), _jsx("p", { className: "mt-8 text-xs text-slate-400", children: "* Exemplo ilustrativo baseado no modelo real do painel executivo do sistema." })] }) })] }));
}
