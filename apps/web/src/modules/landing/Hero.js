import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/base/Card';
import { useTheme } from '../../theme/ThemeProvider';
export default function Hero() {
    const { styles } = useTheme();
    const [kpi, setKpi] = useState({
        risks: 0,
        compliance: 0,
        actions: 0,
    });
    useEffect(() => {
        const t = setTimeout(() => {
            setKpi({ risks: 8, compliance: 54, actions: 12 });
        }, 250);
        return () => clearTimeout(t);
    }, []);
    return (_jsxs("section", { className: "relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-slate-950 to-black" }), _jsx("div", { className: "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.22),transparent_45%)]" }), _jsx("div", { className: "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_60%,rgba(249,115,22,0.18),transparent_50%)]" }), _jsx("div", { className: "relative max-w-7xl mx-auto px-6 min-h-[90vh] flex items-center", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-20 w-full items-center", children: [_jsxs("div", { children: [_jsx("span", { className: `
                inline-flex items-center gap-2 mb-6 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full
                ${styles.border}
                ${styles.textMuted}
                ${styles.surface}
              `, children: "Governan\u00E7a jur\u00EDdica operacional" }), _jsxs("h1", { className: "text-4xl md:text-5xl xl:text-6xl font-semibold text-white leading-tight", children: ["Decis\u00F5es jur\u00EDdicas", _jsx("br", {}), _jsx("span", { className: "text-[#F97316]", children: "sustentadas por dados reais" })] }), _jsx("p", { className: "mt-8 text-lg text-slate-300 max-w-xl", children: "Treinamento, risco humano e auditoria em um sistema \u00FAnico, rastre\u00E1vel e defens\u00E1vel \u2014 do primeiro acesso \u00E0 a\u00E7\u00E3o corretiva." }), _jsxs("ul", { className: "mt-10 space-y-4 text-sm text-slate-300", children: [_jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "mt-1 h-1.5 w-1.5 rounded-full bg-[#F97316]" }), "Backend autoritativo, sem decis\u00E3o manual"] }), _jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "mt-1 h-1.5 w-1.5 rounded-full bg-[#F97316]" }), "Risco recalculado a cada execu\u00E7\u00E3o"] }), _jsxs("li", { className: "flex gap-3", children: [_jsx("span", { className: "mt-1 h-1.5 w-1.5 rounded-full bg-[#F97316]" }), "Hist\u00F3rico defens\u00E1vel e audit\u00E1vel"] })] }), _jsxs("div", { className: "mt-14 flex flex-col sm:flex-row gap-4", children: [_jsx("a", { href: "#how", className: `
                  px-8 py-4 rounded-xl
                  ${styles.buttonPrimary}
                  transition-all duration-200
                  shadow-lg shadow-black/25
                `, children: "Ver como funciona" }), _jsx(Link, { to: "/login", className: `
                  px-8 py-4 rounded-xl
                  ${styles.border}
                  ${styles.textPrimary}
                  hover:bg-white/5
                  transition-all duration-200
                `, children: "Entrar no sistema" })] }), _jsx("p", { className: "mt-6 text-xs text-slate-400", children: "* Painel ilustrativo baseado no modelo real do sistema" })] }), _jsxs("div", { className: "relative", children: [_jsxs(Card, { className: "\n                p-10 space-y-8\n                backdrop-blur\n                bg-slate-900/70\n                border border-white/10\n                shadow-2xl shadow-black/40\n                transition-transform duration-300\n                hover:-translate-y-1\n              ", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-medium text-slate-300 uppercase tracking-wider", children: "Vis\u00E3o executiva" }), _jsx("span", { className: "text-xs text-[#F97316]", children: "Tempo real" })] }), _jsxs("div", { className: "grid grid-cols-3 gap-6", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "text-3xl font-semibold text-white", children: kpi.risks }), _jsx("div", { className: "text-xs text-slate-400", children: "Riscos ativos" })] }), _jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "text-3xl font-semibold text-[#F97316]", children: [kpi.compliance, "%"] }), _jsx("div", { className: "text-xs text-slate-400", children: "Conformidade" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("div", { className: "text-3xl font-semibold text-white", children: kpi.actions }), _jsx("div", { className: "text-xs text-slate-400", children: "A\u00E7\u00F5es pendentes" })] })] }), _jsx("div", { className: "pt-4", children: _jsxs("svg", { viewBox: "0 0 400 160", className: "w-full h-32", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "line", x1: "0", y1: "0", x2: "1", y2: "0", children: [_jsx("stop", { offset: "0%", stopColor: "rgba(249,115,22,0.3)" }), _jsx("stop", { offset: "100%", stopColor: "rgba(249,115,22,1)" })] }) }), _jsx("polyline", { fill: "none", stroke: "url(#line)", strokeWidth: "3", points: "0,110 60,100 120,85 180,92 240,70 300,55 360,45" })] }) })] }), _jsx("div", { className: "pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-[#F97316]/10 blur-3xl" })] })] }) })] }));
}
