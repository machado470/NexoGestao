import { jsx as _jsx } from "react/jsx-runtime";
import { useTheme } from '../theme/useTheme';
export default function DemoBanner() {
    const { styles } = useTheme();
    return (_jsx("div", { className: `rounded px-3 py-2 text-sm border ${styles.cardBorder} ${styles.cardBg}`, children: _jsx("span", { className: styles.textMuted, children: "Ambiente demo \u2014 dados de exemplo." }) }));
}
