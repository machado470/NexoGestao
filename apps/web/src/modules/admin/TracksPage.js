import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/base/Card';
import PageHeader from '../../components/base/PageHeader';
import SectionBase from '../../components/layout/SectionBase';
import StatusBadge from '../../components/base/StatusBadge';
import { getTracks, createTrack, publishTrack, archiveTrack, } from '../../services/tracks';
import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard';
import { useTheme } from '../../theme/ThemeProvider';
export default function TracksPage() {
    const navigate = useNavigate();
    const { styles } = useTheme();
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const { people } = useExecutiveDashboard();
    const hasPeople = people.length > 0;
    async function load() {
        setLoading(true);
        const data = await getTracks();
        setTracks(data);
        setLoading(false);
    }
    useEffect(() => {
        load();
    }, []);
    async function handleCreate() {
        if (!title.trim())
            return;
        setCreating(true);
        await createTrack({ title, description });
        setTitle('');
        setDescription('');
        setCreating(false);
        await load();
    }
    async function handlePublish(id) {
        await publishTrack(id);
        await load();
    }
    async function handleArchive(id) {
        await archiveTrack(id);
        await load();
    }
    if (loading) {
        return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Trilhas" }), _jsx("p", { className: "mt-6 text-slate-400", children: "Carregando trilhas\u2026" })] }));
    }
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Trilhas", description: "Gest\u00E3o institucional das trilhas de treinamento" }), !hasPeople && (_jsx(Card, { className: "mt-6", children: _jsxs("div", { className: "space-y-2 max-w-xl", children: [_jsx("div", { className: "font-medium", children: "Governan\u00E7a incompleta" }), _jsx("p", { className: "text-sm opacity-70", children: "Trilhas s\u00F3 produzem efeito quando existem pessoas vinculadas." }), _jsx("p", { className: "text-sm opacity-70", children: "Voc\u00EA pode criar e estruturar trilhas, mas nenhuma execu\u00E7\u00E3o ocorrer\u00E1 at\u00E9 que pessoas sejam cadastradas." })] }) })), _jsxs(Card, { className: "mt-6 space-y-3", children: [_jsx("div", { className: "font-medium", children: "Nova trilha" }), _jsx("input", { className: "w-full rounded bg-white/10 px-3 py-2 text-sm", placeholder: "T\u00EDtulo da trilha", value: title, onChange: e => setTitle(e.target.value) }), _jsx("textarea", { className: "w-full rounded bg-white/10 px-3 py-2 text-sm", placeholder: "Descri\u00E7\u00E3o (opcional)", value: description, onChange: e => setDescription(e.target.value) }), _jsx("button", { onClick: handleCreate, disabled: creating, className: `self-start rounded px-4 py-2 text-sm disabled:opacity-50 ${styles.buttonPrimary}`, children: "Criar trilha (DRAFT)" })] }), _jsx("div", { className: "mt-8 space-y-4", children: tracks.length === 0 ? (_jsx(Card, { children: _jsx("p", { className: "text-sm opacity-70", children: "Nenhuma trilha criada at\u00E9 o momento." }) })) : (tracks.map(t => (_jsxs(Card, { variant: "clickable", onClick: () => navigate(`/admin/trilhas/${t.id}`), children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: t.title }), _jsxs("div", { className: "text-xs opacity-60", children: ["v", t.version, " \u00B7 ", t.peopleCount, " pessoas"] })] }), _jsx(StatusBadge, { label: t.status, tone: t.status === 'ACTIVE'
                                        ? 'success'
                                        : t.status === 'DRAFT'
                                            ? 'warning'
                                            : 'neutral' })] }), _jsx("div", { className: "w-full h-2 rounded bg-white/10 overflow-hidden", children: _jsx("div", { className: "h-2 rounded bg-emerald-400", style: { width: `${t.completionRate}%` } }) }), _jsxs("div", { className: "mt-3 flex gap-2", children: [t.status === 'DRAFT' && (_jsx("button", { onClick: e => {
                                        e.stopPropagation();
                                        handlePublish(t.id);
                                    }, className: "text-xs px-3 py-1 rounded bg-emerald-500/10 text-emerald-400", children: "Publicar" })), t.status === 'ACTIVE' && (_jsx("button", { onClick: e => {
                                        e.stopPropagation();
                                        handleArchive(t.id);
                                    }, className: "text-xs px-3 py-1 rounded bg-rose-500/10 text-rose-400", children: "Arquivar" }))] })] }, t.id)))) })] }));
}
