import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PageHeader({ title, description, actions, right, }) {
    return (_jsx("header", { className: "mb-10", children: _jsxs("div", { className: "flex flex-col gap-4 md:flex-row md:items-start md:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-semibold tracking-tight", children: title }), description && (_jsx("p", { className: "mt-2 max-w-2xl text-sm md:text-base text-slate-400", children: description }))] }), (actions || right) && (_jsxs("div", { className: "flex items-center gap-3", children: [actions, right] }))] }) }));
}
