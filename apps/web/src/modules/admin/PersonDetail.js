import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import StatusBadge from '../../components/base/StatusBadge';
import { useTheme } from '../../theme/useTheme';
import { getPersonById } from '../../services/people';
export default function PersonDetail() {
    const { styles } = useTheme();
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [person, setPerson] = useState(null);
    useEffect(() => {
        if (!id)
            return;
        getPersonById(id)
            .then((data) => setPerson(data))
            .finally(() => setLoading(false));
    }, [id]);
    if (loading) {
        return (_jsx(SectionBase, { children: _jsx("p", { className: `text-sm ${styles.textMuted}`, children: "Carregando\u2026" }) }));
    }
    if (!person) {
        return (_jsx(SectionBase, { children: _jsx("p", { className: "text-sm text-rose-400", children: "Pessoa n\u00E3o encontrada." }) }));
    }
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: person.name, description: "Detalhe institucional da pessoa" }), _jsxs(Card, { className: "mt-6 space-y-4", children: [_jsxs("div", { children: [_jsx("div", { className: `text-sm ${styles.textMuted}`, children: "Departamento" }), _jsx("div", { className: "font-medium", children: person.department ?? '—' })] }), _jsxs("div", { children: [_jsx("div", { className: `text-sm ${styles.textMuted}`, children: "Status" }), _jsx(StatusBadge, { label: person.status, tone: "neutral" })] }), _jsx("div", { className: "pt-4", children: _jsx("button", { onClick: () => navigate('/admin/pessoas'), className: `text-xs rounded px-3 py-1 disabled:opacity-40 ${styles.buttonPrimary}`, children: "Voltar" }) })] })] }));
}
