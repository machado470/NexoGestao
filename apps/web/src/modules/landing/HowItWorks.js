import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/ThemeProvider';
const steps = [
    {
        step: '01',
        title: 'Entrada controlada',
        description: 'O acesso ao sistema inicia com definição clara de papéis. Nenhum usuário opera fora de um contexto organizacional.',
    },
    {
        step: '02',
        title: 'Atribuição de trilhas',
        description: 'Cada pessoa recebe trilhas vinculadas à sua função, risco e histórico operacional.',
    },
    {
        step: '03',
        title: 'Execução monitorada',
        description: 'O sistema acompanha execução, atrasos e resultados. Não há avanço sem registro.',
    },
    {
        step: '04',
        title: 'Cálculo automático de risco',
        description: 'O risco humano é recalculado continuamente com base em comportamento real, recorrência e gravidade.',
    },
    {
        step: '05',
        title: 'Ação corretiva obrigatória',
        description: 'Quando limites são ultrapassados, ações corretivas são geradas automaticamente e exigidas pelo sistema.',
    },
];
export default function HowItWorks() {
    const { styles } = useTheme();
    return (_jsxs("section", { className: "relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 -z-10 bg-gradient-to-b from-slate-950 via-black to-black" }), _jsx("div", { className: "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.12),transparent_45%)]" }), _jsx(SectionBase, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-32", children: [_jsxs("div", { className: "max-w-3xl mb-24", children: [_jsx("span", { className: `
                inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full
                ${styles.border}
                ${styles.textMuted}
                ${styles.surface}
              `, children: "Ciclo operacional" }), _jsxs("h2", { className: "text-3xl md:text-4xl font-semibold text-white leading-tight", children: ["Um ciclo fechado.", _jsx("br", {}), _jsx("span", { className: "text-[#F97316]", children: "Sem atalhos. Sem exce\u00E7\u00F5es." })] }), _jsx("p", { className: "mt-6 text-lg text-slate-300", children: "O NexoGestao n\u00E3o depende de boa vontade, lembretes manuais ou fiscaliza\u00E7\u00E3o informal. O sistema conduz pessoas, mede risco e exige a\u00E7\u00E3o de forma autom\u00E1tica." })] }), _jsx("div", { className: "grid gap-8 md:grid-cols-2 lg:grid-cols-3", children: steps.map(s => (_jsxs(Card, { className: "\n                  relative p-10\n                  bg-slate-900/70\n                  backdrop-blur\n                  border border-white/10\n                  transition-all duration-300\n                  hover:-translate-y-1\n                  hover:shadow-2xl hover:shadow-black/40\n                ", children: [_jsxs("div", { className: "flex items-center gap-4 mb-6", children: [_jsx("div", { className: "text-sm font-semibold text-[#F97316]", children: s.step }), _jsx("div", { className: "h-px flex-1 bg-white/10" })] }), _jsx("h3", { className: "text-lg font-medium text-white mb-4", children: s.title }), _jsx("p", { className: "text-sm text-slate-300 leading-relaxed", children: s.description }), _jsx("div", { className: "absolute inset-0 pointer-events-none rounded-2xl bg-[#F97316]/5 opacity-0 hover:opacity-100 transition" })] }, s.step))) })] }) })] }));
}
