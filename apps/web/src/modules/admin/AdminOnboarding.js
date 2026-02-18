import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/useTheme';
export default function AdminOnboarding() {
    const { styles } = useTheme();
    const navigate = useNavigate();
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Onboarding institucional", description: "Primeiros passos para ativar a governan\u00E7a" }), _jsxs(Card, { className: "mt-8 space-y-6 max-w-xl", children: [_jsx("p", { className: `text-sm ${styles.textMuted}`, children: "Para que o sistema produza efeito real, \u00E9 necess\u00E1rio:" }), _jsxs("ul", { className: "list-disc list-inside text-sm space-y-2", children: [_jsx("li", { children: "Cadastrar pessoas" }), _jsx("li", { children: "Criar trilhas" }), _jsx("li", { children: "Publicar trilhas" })] }), _jsx("button", { onClick: () => navigate('/admin/pessoas'), className: `w-full px-6 py-3 rounded ${styles.buttonPrimary}`, children: "Iniciar configura\u00E7\u00E3o" })] })] }));
}
