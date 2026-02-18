import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import api from '../../services/api';
import Card from '../../components/base/Card';
import PageHeader from '../../components/base/PageHeader';
import { useTheme } from '../../theme/useTheme';
export default function CustomersPage() {
    const { styles } = useTheme();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [error, setError] = useState(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    async function load() {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/customers');
            setItems(res.data ?? []);
        }
        catch (e) {
            setError(e?.response?.data?.error?.message ?? 'Erro ao carregar clientes');
        }
        finally {
            setLoading(false);
        }
    }
    async function create() {
        setError(null);
        try {
            if (!name.trim() || !phone.trim()) {
                setError('Nome e telefone são obrigatórios');
                return;
            }
            await api.post('/customers', {
                name,
                phone,
                email: email || undefined,
            });
            setName('');
            setPhone('');
            setEmail('');
            await load();
        }
        catch (e) {
            setError(e?.response?.data?.error?.message ?? 'Erro ao criar cliente');
        }
    }
    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (_jsxs("div", { className: "space-y-10", children: [_jsx(PageHeader, { title: "Clientes", description: "Base de clientes (NexoGest\u00E3o Oficial)" }), _jsxs(Card, { children: [_jsxs("div", { className: "grid gap-3 md:grid-cols-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs opacity-60 mb-1", children: "Nome" }), _jsx("input", { value: name, onChange: e => setName(e.target.value), className: `w-full rounded px-3 py-2 text-sm ${styles.input}`, placeholder: "Ex: Jo\u00E3o Silva" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs opacity-60 mb-1", children: "WhatsApp" }), _jsx("input", { value: phone, onChange: e => setPhone(e.target.value), className: `w-full rounded px-3 py-2 text-sm ${styles.input}`, placeholder: "Ex: 5547999991111" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs opacity-60 mb-1", children: "Email (opcional)" }), _jsx("input", { value: email, onChange: e => setEmail(e.target.value), className: `w-full rounded px-3 py-2 text-sm ${styles.input}`, placeholder: "ex@email.com" })] })] }), _jsxs("div", { className: "mt-4 flex items-center gap-3", children: [_jsx("button", { onClick: create, className: `rounded px-4 py-2 text-sm ${styles.buttonPrimary}`, children: "Criar cliente" }), _jsx("button", { onClick: load, className: `rounded px-4 py-2 text-sm ${styles.buttonSecondary}`, children: "Recarregar" }), error ? (_jsx("span", { className: "text-sm text-rose-400", children: error })) : null] })] }), _jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "font-medium", children: "Lista" }), _jsx("div", { className: "text-xs opacity-60", children: loading ? 'Carregando…' : `${items.length} clientes` })] }), _jsx("div", { className: "mt-4", children: loading ? (_jsx("div", { className: "text-sm opacity-60", children: "Carregando\u2026" })) : items.length === 0 ? (_jsx("div", { className: "text-sm opacity-60", children: "Nenhum cliente cadastrado." })) : (_jsx("ul", { className: "space-y-2 text-sm", children: items.map(c => (_jsxs("li", { className: "flex items-center justify-between rounded border border-white/10 px-3 py-2", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: c.name }), _jsxs("div", { className: "text-xs opacity-60", children: [c.phone, c.email ? ` • ${c.email}` : ''] })] }), _jsx("div", { className: "text-xs opacity-60", children: c.active ? 'ativo' : 'inativo' })] }, c.id))) })) })] })] }));
}
