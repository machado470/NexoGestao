import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/useTheme';
import { useAuth } from '../../auth/useAuth';
import { getMe } from '../../services/me';
export default function Login() {
    const { styles } = useTheme();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        const ok = await login(email.trim(), password);
        if (!ok) {
            setSubmitting(false);
            setError('Credenciais inválidas.');
            return;
        }
        const me = await getMe();
        setSubmitting(false);
        if (me?.requiresOnboarding) {
            navigate('/onboarding', { replace: true });
            return;
        }
        const role = me?.user?.role;
        if (role === 'ADMIN') {
            navigate('/admin', { replace: true });
            return;
        }
        navigate('/collaborator', { replace: true });
    }
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Acesso", description: "Entre com seu e-mail e senha" }), _jsx(Card, { className: "mt-8 max-w-md space-y-4", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("div", { className: `text-sm ${styles.textMuted}`, children: "E-mail" }), _jsx("input", { value: email, onChange: e => setEmail(e.target.value), className: "mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20", placeholder: "voce@empresa.com", autoComplete: "email" })] }), _jsxs("div", { children: [_jsx("div", { className: `text-sm ${styles.textMuted}`, children: "Senha" }), _jsx("input", { value: password, onChange: e => setPassword(e.target.value), className: "mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", type: "password", autoComplete: "current-password" })] }), error && _jsx("div", { className: "text-sm text-rose-400", children: error }), _jsx("button", { disabled: submitting, className: `w-full py-2 rounded disabled:opacity-50 ${styles.buttonPrimary}`, type: "submit", children: submitting ? 'Entrando…' : 'Entrar' })] }) })] }));
}
