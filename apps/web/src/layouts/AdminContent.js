import { jsx as _jsx } from "react/jsx-runtime";
import { useTheme } from '../theme/useTheme';
export default function AdminContent({ children }) {
    const { styles } = useTheme();
    return (_jsx("main", { className: `
        flex-1
        px-8
        pb-16
        ${styles.text}
      `, children: _jsx("div", { className: "mx-auto w-full max-w-7xl", children: children }) }));
}
