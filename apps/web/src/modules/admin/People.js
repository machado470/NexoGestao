import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import SectionBase from '../../components/layout/SectionBase';
import { useTheme } from '../../theme/ThemeProvider';
export default function People() {
    const { styles } = useTheme();
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Pessoas", description: "Gest\u00E3o e cadastro de pessoas" }), _jsx("div", { className: "mt-6", children: _jsx(Link, { to: "/admin/pessoas/nova", className: `text-sm underline ${styles.accent} hover:opacity-100 opacity-90`, children: "Cadastrar nova pessoa" }) })] }));
}
