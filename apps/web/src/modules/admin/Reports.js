import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import { getExecutiveReport, } from '../../services/reports';
export default function Reports() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    useEffect(() => {
        async function load() {
            try {
                const report = await getExecutiveReport();
                setData(report);
            }
            finally {
                setLoading(false);
            }
        }
        load();
    }, []);
    if (loading) {
        return (_jsx("div", { className: "text-sm opacity-60", children: "Carregando relat\u00F3rio\u2026" }));
    }
    if (!data) {
        return (_jsx("div", { className: "text-sm opacity-60", children: "Nenhum dado dispon\u00EDvel." }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { title: "Relat\u00F3rio Executivo", description: "Indicadores consolidados de risco e a\u00E7\u00F5es." }), _jsx(Card, { children: _jsxs("div", { className: "text-sm space-y-1", children: [_jsxs("div", { children: ["Pessoas OK: ", data.peopleStats.OK] }), _jsxs("div", { children: ["Pessoas em aten\u00E7\u00E3o:", ' ', data.peopleStats.WARNING] }), _jsxs("div", { children: ["Pessoas cr\u00EDticas:", ' ', data.peopleStats.CRITICAL] }), _jsxs("div", { children: ["A\u00E7\u00F5es corretivas abertas:", ' ', data.correctiveOpenCount] })] }) })] }));
}
