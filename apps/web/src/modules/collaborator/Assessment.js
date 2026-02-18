import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import useAssessment from '../../hooks/useAssessment';
import { useTheme } from '../../theme/ThemeProvider';
export default function Assessment() {
    const { styles } = useTheme();
    const { submitAssessment, loading } = useAssessment();
    return (_jsxs("div", { className: "space-y-8", children: [_jsx(PageHeader, { title: "Avalia\u00E7\u00E3o", description: "Responda com aten\u00E7\u00E3o. Esta avalia\u00E7\u00E3o impacta seu risco." }), _jsx(Card, { children: _jsx("button", { onClick: () => submitAssessment({
                        assignmentId: 'manual',
                        score: 100,
                    }), disabled: loading, className: `rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles.buttonPrimary}`, children: loading ? 'Enviando…' : 'Enviar avaliação' }) })] }));
}
