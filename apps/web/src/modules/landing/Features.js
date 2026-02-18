import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
export default function Features() {
    const features = [
        {
            title: 'Decisões explicáveis',
            description: 'Cada decisão é sustentada por dados reais, com histórico, contexto e justificativa clara.',
        },
        {
            title: 'Rastreabilidade completa',
            description: 'Eventos críticos são registrados e auditáveis, permitindo defesa técnica e melhoria contínua.',
        },
        {
            title: 'Governança humana',
            description: 'O sistema respeita exceções reais e atua como apoio à decisão — sem virar “polícia de processo”.',
        },
    ];
    return (_jsxs(SectionBase, { children: [_jsxs("div", { className: "max-w-2xl mb-20", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-semibold text-white", children: "Governan\u00E7a pr\u00E1tica, n\u00E3o teoria" }), _jsx("p", { className: "mt-4 text-slate-400", children: "O NexoGestao foi projetado para ambientes reais, onde decis\u00F5es precisam ser explic\u00E1veis, audit\u00E1veis e sustent\u00E1veis." })] }), _jsx("div", { className: "grid gap-8 md:grid-cols-3", children: features.map(f => (_jsxs(Card, { variant: "panel", children: [_jsx("h3", { className: "text-lg font-medium text-white", children: f.title }), _jsx("p", { className: "mt-3 text-sm text-slate-400 leading-relaxed", children: f.description })] }, f.title))) })] }));
}
