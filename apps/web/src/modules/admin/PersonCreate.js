import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/ThemeProvider';
import { createPerson } from '../../services/people';
export default function PersonCreate() {
    const { styles } = useTheme();
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [department, setDepartment] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    async function save() {
        if (!name.trim())
            return;
        setSaving(true);
        setError(null);
        try {
            await createPerson({ name, department });
            navigate('/admin/pessoas');
        }
        catch {
            setError('Erro ao cadastrar pessoa');
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Cadastrar pessoa", description: "Entrada institucional" }), _jsxs(Card, { className: "mt-6 max-w-xl space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: `text-sm ${styles.textMuted}`, children: "Nome" }), _jsx("input", { value: name, onChange: e => setName(e.target.value), className: "w-full mt-1 rounded bg-white/10 border border-white/20 px-3 py-2 text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: `text-sm ${styles.textMuted}`, children: "Departamento" }), _jsx("input", { value: department, onChange: e => setDepartment(e.target.value), className: "w-full mt-1 rounded bg-white/10 border border-white/20 px-3 py-2 text-sm" })] }), error && _jsx("p", { className: "text-sm text-rose-400", children: error }), _jsx("button", { disabled: saving, onClick: save, className: `rounded px-4 py-2 text-sm disabled:opacity-50 ${styles.buttonPrimary}`, children: saving ? 'Salvando…' : 'Cadastrar' })] })] }));
}
