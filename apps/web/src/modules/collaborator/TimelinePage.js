import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import CollaboratorShell from '../../layouts/CollaboratorShell';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import EventTimeline from '../../components/base/EventTimeline';
import { getMe } from '../../services/me';
import { getPersonTimeline } from '../../services/timeline';
export default function TimelinePage() {
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState([]);
    async function load() {
        setLoading(true);
        const me = await getMe();
        if (!me.user.personId) {
            setEvents([]);
            setLoading(false);
            return;
        }
        const timeline = await getPersonTimeline(me.user.personId);
        setEvents(timeline);
        setLoading(false);
    }
    useEffect(() => {
        load();
    }, []);
    return (_jsxs(CollaboratorShell, { children: [_jsx(PageHeader, { title: "Linha do tempo", description: "Registro das suas a\u00E7\u00F5es e eventos" }), loading && (_jsx("p", { className: "text-sm opacity-60", children: "Carregando eventos\u2026" })), !loading && (_jsx(Card, { children: _jsx(EventTimeline, { events: events }) }))] }));
}
