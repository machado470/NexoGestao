import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { getExecutiveReport, getExecutiveMetrics } from '../../services/reports';
export default function Reports() {
    const [loading, setLoading] = useState(true);
    const [report, setReport] = useState(null);
    const [metrics, setMetrics] = useState(null);
    useEffect(() => {
        Promise.all([getExecutiveReport(), getExecutiveMetrics(30)])
            .then(([r, m]) => {
            setReport(r);
            setMetrics(m);
        })
            .finally(() => setLoading(false));
    }, []);
    if (loading)
        return _jsx("div", { className: "p-6", children: "Carregando..." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Relat\u00F3rios" }), _jsxs("div", { className: "border rounded p-4", children: [_jsx("div", { className: "text-sm font-semibold mb-2", children: "Executive Report" }), _jsx("pre", { className: "text-xs overflow-auto", children: JSON.stringify(report, null, 2) })] }), _jsxs("div", { className: "border rounded p-4", children: [_jsx("div", { className: "text-sm font-semibold mb-2", children: "M\u00E9tricas (SLA)" }), _jsx("pre", { className: "text-xs overflow-auto", children: JSON.stringify(metrics, null, 2) })] })] }));
}
