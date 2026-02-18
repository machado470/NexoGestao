import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { themes } from './themes';
import { ThemeContext } from './themeContext';
// ✅ compat: imports antigos fazem "from '../theme/ThemeProvider'"
export { useTheme } from './useTheme';
export function ThemeProvider({ children, forceTheme, }) {
    const [theme, setTheme] = useState(forceTheme ?? 'orange');
    useEffect(() => {
        if (forceTheme) {
            setTheme(forceTheme);
            return;
        }
        const saved = localStorage.getItem('theme');
        if (saved && themes[saved]) {
            setTheme(saved);
            return;
        }
        setTheme('orange');
    }, [forceTheme]);
    useEffect(() => {
        if (!forceTheme) {
            localStorage.setItem('theme', theme);
        }
    }, [theme, forceTheme]);
    function toggleTheme() {
        if (forceTheme)
            return;
        setTheme(prev => (prev === 'offwhite' ? 'orange' : 'offwhite'));
    }
    return (_jsx(ThemeContext.Provider, { value: {
            theme,
            setTheme,
            toggleTheme,
            styles: themes[theme],
        }, children: children }));
}
