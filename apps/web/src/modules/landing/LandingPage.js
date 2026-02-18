import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useAuth } from '../../auth/useAuth';
import { useTheme } from '../../theme/useTheme';
export default function LandingPage() {
    const navigate = useNavigate();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const { styles } = useTheme();
    function go() {
        if (isAuthenticated) {
            navigate('/admin', { replace: true });
        }
        else {
            navigate('/login', { replace: true });
        }
    }
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "NexoGest\u00E3o", description: "Governan\u00E7a operacional sem teatro" }), _jsxs(Card, { className: "mt-8 max-w-xl space-y-4", children: [_jsx("p", { className: `text-sm ${styles.textMuted}`, children: "Cadastre pessoas, publique trilhas, execute e acompanhe conformidade." }), _jsx("button", { disabled: authLoading, onClick: go, className: `w-full px-6 py-3 rounded disabled:opacity-50 ${styles.buttonPrimary}`, children: authLoading ? 'Carregando…' : 'Entrar' })] })] }));
}
