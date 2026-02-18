import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import StatusBadge from '../../components/base/StatusBadge';
import { getTrack, publishTrack, archiveTrack, } from '../../services/tracks';
import { listTrackItems, removeTrackItem, } from '../../services/trackItems';
export default function TrackDetailPage() {
    const { id } = useParams();
    const [track, setTrack] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => {
        if (!id)
            return;
        const [trackData, itemsData] = await Promise.all([
            getTrack(id),
            listTrackItems(id),
        ]);
        setTrack(trackData);
        setItems(itemsData);
        setLoading(false);
    }, [id]);
    useEffect(() => {
        load();
    }, [load]);
    function confirmAction(message) {
        return window.confirm(message);
    }
    async function handlePublish() {
        if (!id || !track)
            return;
        if (!confirmAction('Publicar esta trilha?'))
            return;
        setBusy(true);
        await publishTrack(id);
        await load();
        setBusy(false);
    }
    async function handleArchive() {
        if (!id || !track)
            return;
        if (!confirmAction('Arquivar esta trilha?'))
            return;
        setBusy(true);
        await archiveTrack(id);
        await load();
        setBusy(false);
    }
    async function handleRemoveItem(itemId) {
        if (!confirmAction('Remover este item?'))
            return;
        setBusy(true);
        await removeTrackItem(itemId);
        await load();
        setBusy(false);
    }
    if (loading || !track) {
        return (_jsx("div", { className: "text-sm opacity-60", children: "Carregando trilha\u2026" }));
    }
    const isDraft = track.status === 'DRAFT';
    const isArchived = track.status === 'ARCHIVED';
    return (_jsxs("div", { className: "space-y-8", children: [_jsx(PageHeader, { title: track.title, description: track.description ?? undefined }), _jsx(Card, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(StatusBadge, { label: track.status }), _jsxs("div", { className: "flex gap-2", children: [isDraft && (_jsx("button", { disabled: busy, onClick: handlePublish, className: "px-3 py-1 rounded bg-emerald-600 text-white", children: "Publicar" })), !isArchived && (_jsx("button", { disabled: busy, onClick: handleArchive, className: "px-3 py-1 rounded bg-rose-600 text-white", children: "Arquivar" }))] })] }) }), _jsxs(Card, { children: [_jsx("div", { className: "font-medium mb-3", children: "Itens da trilha" }), items.length === 0 && (_jsx("p", { className: "text-sm opacity-60", children: "Nenhum item criado." })), _jsx("ul", { className: "space-y-2 text-sm", children: items.map(i => (_jsxs("li", { className: "flex items-center justify-between", children: [_jsxs("span", { children: [i.order, ". ", i.title] }), isDraft && (_jsx("button", { onClick: () => handleRemoveItem(i.id), className: "text-xs px-2 py-1 rounded bg-rose-600 text-white", children: "Remover" }))] }, i.id))) })] })] }));
}
