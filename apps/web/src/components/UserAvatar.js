import { jsx as _jsx } from "react/jsx-runtime";
import { useTheme } from '../theme/useTheme';
export default function UserAvatar({ name, size = 40, }) {
    const { styles } = useTheme();
    const initials = name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    return (_jsx("div", { className: `
        flex items-center justify-center
        rounded-full
        font-semibold
        ${styles.surface}
        ${styles.border}
      `, style: {
            width: size,
            height: size,
        }, children: initials }));
}
