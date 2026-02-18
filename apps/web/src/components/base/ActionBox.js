import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ActionBox({ title, description, actionLabel, onAction, }) {
    return (_jsxs("div", { className: "rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 space-y-2", children: [_jsx("div", { className: "font-semibold text-amber-500", children: title }), _jsx("div", { className: "text-sm opacity-70", children: description }), _jsx("button", { onClick: onAction, className: "mt-2 rounded bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400", children: actionLabel })] }));
}
