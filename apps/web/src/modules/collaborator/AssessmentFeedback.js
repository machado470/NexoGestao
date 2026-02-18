import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation, useNavigate } from 'react-router-dom';
export default function AssessmentFeedback() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state;
    const feedback = state?.feedback;
    if (!feedback) {
        return (_jsx("div", { className: "text-slate-400", children: "Nenhum feedback dispon\u00EDvel." }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h2", { className: "text-xl font-semibold", children: "Resultado da Avalia\u00E7\u00E3o" }), _jsxs("div", { className: "bg-slate-900 border border-slate-700 rounded p-4 space-y-3", children: [_jsx("div", { className: "text-sm text-slate-400", children: "Nota obtida" }), _jsx("div", { className: "text-3xl font-bold", children: feedback.score }), _jsx("div", { className: "mt-4 text-sm text-slate-400", children: "Avalia\u00E7\u00E3o do sistema" }), _jsx("div", { className: "text-base", children: feedback.message }), _jsx("div", { className: "mt-4 text-sm text-slate-400", children: "Pr\u00F3ximo passo" }), _jsx("div", { className: "text-base font-medium", children: feedback.nextStep })] }), _jsx("button", { onClick: () => navigate('/collaborator'), className: "bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-white", children: "Voltar ao painel" })] }));
}
