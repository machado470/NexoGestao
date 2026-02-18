import { jsx as _jsx } from "react/jsx-runtime";
export default function RootLayout({ children, }) {
    return (_jsx("div", { style: {
            minHeight: '100vh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f4f4f5',
        }, children: children }));
}
