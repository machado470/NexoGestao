import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/ThemeProvider';
const modules = [
    {
        title: 'Pessoas',
        description: 'Gestão clara de pessoas, papéis e responsabilidades. Cada usuário opera dentro de um contexto organizacional definido.',
    },
    {
        title: 'Trilhas de execução',
        description: 'Conteúdos, rotinas e validações atribuídos conforme função, risco e histórico. O padrão deixa de ser “cada um faz do seu jeito”.',
    },
    {
        title: 'Avaliações',
        description: 'Execuções registradas, resultados mensurados e histórico completo por pessoa e por trilha.',
    },
    {
        title: 'Risco humano',
        description: 'Cálculo automático de risco baseado em comportamento real, recorrência e gravidade.',
    },
    {
        title: 'Ações corretivas',
        description: 'Quando o risco exige, o sistema gera ações obrigatórias e acompanha sua execução.',
    },
    {
        title: 'Auditoria',
        description: 'Linha do tempo defensável de decisões, execuções e ações. Tudo rastreável.',
    },
];
export default function Modules() {
    const { styles } = useTheme();
    return (_jsxs("section", { className: "relative overflow-hidden", children: [_jsx("div", { className: "absolute inset-0 -z-10 bg-gradient-to-b from-black via-slate-950 to-slate-950" }), _jsx("div", { className: "absolute inset-0 -z-10 bg-[radial-gradient(circle_at_60%_30%,rgba(249,115,22,0.12),transparent_45%)]" }), _jsx(SectionBase, { children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-32", children: [_jsxs("div", { className: "max-w-3xl mb-24", children: [_jsx("span", { className: `
                inline-block mb-4 px-4 py-1.5 text-xs tracking-wider uppercase rounded-full
                ${styles.border}
                ${styles.textMuted}
                ${styles.surface}
              `, children: "Estrutura do sistema" }), _jsxs("h2", { className: "text-3xl md:text-4xl font-semibold text-white leading-tight", children: ["Um sistema completo.", _jsx("br", {}), _jsx("span", { className: "text-[#F97316]", children: "Sem m\u00F3dulos decorativos." })] }), _jsx("p", { className: "mt-6 text-lg text-slate-300", children: "Cada m\u00F3dulo do NexoGestao existe para sustentar decis\u00F5es reais, reduzir risco humano e garantir governan\u00E7a cont\u00EDnua \u2014 sem depender de controles paralelos." })] }), _jsx("div", { className: "grid gap-8 sm:grid-cols-2 lg:grid-cols-3", children: modules.map(m => (_jsxs(Card, { className: "\n                  relative p-10\n                  bg-slate-900/70\n                  backdrop-blur\n                  border border-white/10\n                  transition-all duration-300\n                  hover:-translate-y-1\n                  hover:shadow-2xl hover:shadow-black/40\n                ", children: [_jsx("h3", { className: "text-lg font-medium text-white mb-4", children: m.title }), _jsx("p", { className: "text-sm text-slate-300 leading-relaxed", children: m.description }), _jsx("div", { className: "absolute inset-0 pointer-events-none rounded-2xl bg-[#F97316]/5 opacity-0 hover:opacity-100 transition" })] }, m.title))) })] }) })] }));
}
