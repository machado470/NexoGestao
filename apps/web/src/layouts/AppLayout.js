import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AppLayout({ children }) {
    return (_jsxs("div", { className: "min-h-screen bg-black text-white", children: [_jsx("header", { className: "h-14 flex items-center px-6 border-b border-zinc-800", children: _jsx("span", { className: "font-bold text-red-500", children: "NexoGestao" }) }), _jsx("main", { className: "p-6", children: children })] }));
}
