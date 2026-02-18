import { jsx as _jsx } from "react/jsx-runtime";
import Router from './router';
import { ThemeProvider } from './theme/ThemeProvider';
import { useTheme } from './theme/useTheme';
function ThemeCanvas() {
    const { styles } = useTheme();
    return (_jsx("div", { className: `
        min-h-screen
        ${styles.bg}
        ${styles.text}
      `, children: _jsx(Router, {}) }));
}
export default function App() {
    return (_jsx(ThemeProvider, { children: _jsx(ThemeCanvas, {}) }));
}
