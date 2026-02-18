import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/ThemeProvider';
import { activateAccount } from '../../services/auth';
export default function ActivateAccount() {
    const { styles } = useTheme();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') ?? '';
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [ok, setOk] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        setError(null);
    }, [password, confirm]);
    async function submit() {
        if (!token) {
            setError('Token inválido');
            return;
        }
        if (!password || password.length < 6) {
            setError('Senha deve ter pelo menos 6 caracteres');
            return;
        }
        if (password !== confirm) {
            setError('As senhas não conferem');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await activateAccount({ token, password });
            setOk(true);
        }
        catch {
            setError('Não foi possível ativar a conta');
        }
        finally {
            setLoading(false);
        }
    }
    return (_jsx(SectionBase, { children: _jsx("div", { className: "max-w-lg mx-auto py-20", children: _jsxs(Card, { className: "p-8", children: [_jsx("h1", { className: "text-xl font-semibold", children: "Ativar conta" }), _jsx("p", { className: `mt-2 text-sm ${styles.textMuted}`, children: "Defina sua senha para concluir a ativa\u00E7\u00E3o." }), ok ? (_jsxs("div", { className: "mt-6 space-y-4", children: [_jsx("p", { className: "text-sm text-emerald-400", children: "Conta ativada com sucesso." }), _jsx(Link, { to: "/login", className: `text-sm underline ${styles.accent}`, children: "Ir para login" })] })) : (_jsxs("div", { className: "mt-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: `text-sm ${styles.textMuted}`, children: "Nova senha" }), _jsx("input", { type: "password", value: password, onChange: e => setPassword(e.target.value), className: `
                    mt-1 w-full rounded-lg px-3 py-2 text-sm
                    bg-white/10 border border-white/20
                    focus:outline-none focus:ring-2 focus:ring-[#F97316]/40
                  ` })] }), _jsxs("div", { children: [_jsx("label", { className: `text-sm ${styles.textMuted}`, children: "Confirmar senha" }), _jsx("input", { type: "password", value: confirm, onChange: e => setConfirm(e.target.value), className: `
                    mt-1 w-full rounded-lg px-3 py-2 text-sm
                    bg-white/10 border border-white/20
                    focus:outline-none focus:ring-2 focus:ring-[#F97316]/40
                  ` })] }), error && _jsx("p", { className: "text-sm text-rose-400", children: error }), _jsx("button", { onClick: submit, disabled: loading, className: `w-full rounded-lg px-4 py-2 text-sm transition disabled:opacity-50 ${styles.buttonPrimary}`, children: loading ? 'Ativando…' : 'Ativar conta' })] }))] }) }) }));
}
