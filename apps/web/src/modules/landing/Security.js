import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/ThemeProvider';
const pillars = [
    {
        title: 'Defesa operacional',
        description: 'Decisões, execuções e ações ficam registradas de forma rastreável, reduzindo exposição em auditorias e questionamentos.',
    },
    {
        title: 'Controle de acesso',
        description: 'Papéis bem definidos, permissões claras e separação de responsabilidades. Cada usuário vê e executa apenas o que lhe compete.',
    },
    {
        title: 'Integridade dos dados',
        description: 'Registros consistentes e rastreáveis. O histórico não depende de boa-fé nem vira “versão da semana”.',
    },
    {
        title: 'Conformidade contínua',
        description: 'Conformidade não é evento pontual. O sistema monitora comportamento real e reage automaticamente a desvios.',
    },
];
export default function Security() {
    const { styles } = useTheme();
    return (_jsxs("section", { className: "relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-black to-black" }), _jsx("div", { className: "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_40%_30%,rgba(249,115,22,0.10),transparent_45%)]" }), _jsx(SectionBase, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-32", children: [_jsxs("div", { className: "max-w-3xl mb-24", children: [_jsx("span", { className: `
                inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full
                ${styles.border}
                ${styles.textMuted}
                ${styles.surface}
              `, children: "Seguran\u00E7a e conformidade" }), _jsxs("h2", { className: "text-3xl md:text-4xl font-semibold text-white leading-tight", children: ["Seguran\u00E7a n\u00E3o \u00E9 promessa.", _jsx("br", {}), _jsx("span", { className: "text-[#F97316]", children: "\u00C9 resili\u00EAncia quando falha." })] }), _jsx("p", { className: "mt-6 text-lg text-slate-300", children: "O NexoGestao foi projetado para operar em ambientes reais, com falhas humanas, atrasos e decis\u00F5es imperfeitas \u2014 mantendo rastreabilidade, controle e defesa operacional." })] }), _jsx("div", { className: "grid gap-8 sm:grid-cols-2 lg:grid-cols-4", children: pillars.map(p => (_jsxs(Card, { className: "\n                  relative p-10\n                  bg-slate-900/70\n                  backdrop-blur\n                  border border-white/10\n                  transition-all duration-300\n                  hover:-translate-y-1\n                  hover:shadow-2xl hover:shadow-black/40\n                ", children: [_jsx("h3", { className: "text-lg font-medium text-white mb-4", children: p.title }), _jsx("p", { className: "text-sm text-slate-300 leading-relaxed", children: p.description }), _jsx("div", { className: "absolute inset-0 pointer-events-none rounded-2xl bg-[#F97316]/5 opacity-0 hover:opacity-100 transition" })] }, p.title))) })] }) })] }));
}
