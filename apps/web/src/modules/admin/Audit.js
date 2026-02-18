import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import EventTimeline from '../../components/base/EventTimeline';
import { getPersonTimeline } from '../../services/timeline';
import api from '../../services/api';
export default function Audit() {
    const [people, setPeople] = useState([]);
    const [selectedPerson, setSelectedPerson] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    async function loadPeople() {
        const res = await api.get('/people');
        setPeople(res.data.data);
    }
    async function loadTimeline(personId) {
        setLoading(true);
        const timeline = await getPersonTimeline(personId);
        setEvents(timeline);
        setLoading(false);
    }
    useEffect(() => {
        loadPeople();
    }, []);
    useEffect(() => {
        if (selectedPerson) {
            loadTimeline(selectedPerson);
        }
    }, [selectedPerson]);
    return (_jsxs("div", { className: "space-y-8", children: [_jsx(PageHeader, { title: "Auditoria", description: "Linha do tempo audit\u00E1vel de decis\u00F5es, eventos e impactos de risco." }), _jsxs(Card, { children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { className: "block text-sm mb-1", children: "Pessoa" }), _jsxs("select", { className: "bg-white/5 rounded px-3 py-2 text-sm w-full", value: selectedPerson ?? '', onChange: e => setSelectedPerson(e.target.value), children: [_jsx("option", { value: "", children: "Selecione uma pessoa" }), people.map(p => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })] }), !selectedPerson && (_jsx("div", { className: "text-sm text-slate-400", children: "Selecione uma pessoa para visualizar a auditoria completa." })), loading && (_jsx("div", { className: "text-sm text-slate-400", children: "Carregando auditoria\u2026" })), !loading && selectedPerson && (_jsx(EventTimeline, { events: events }))] })] }));
}
