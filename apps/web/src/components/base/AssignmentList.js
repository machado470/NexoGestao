import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../theme/ThemeProvider';
export default function AssignmentList({ assignments, }) {
    const navigate = useNavigate();
    const { styles } = useTheme();
    return (_jsx("div", { className: "space-y-4", children: assignments.map(a => (_jsx("div", { className: "bg-slate-900 rounded p-4 space-y-2", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: a.track.title }), _jsxs("div", { className: "text-xs text-slate-400", children: ["Progresso: ", a.progress, "%"] })] }), _jsx("button", { className: `text-sm px-3 py-1 rounded ${styles.buttonPrimary}`, onClick: () => navigate(`/collaborator/assessment/${a.id}`), children: "Avaliar" })] }) }, a.id))) }));
}
