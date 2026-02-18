import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Card({ children, className = '', variant = 'default', onClick, header, right, actions, }) {
    const base = `
    relative
    rounded-2xl
    border border-white/10
    backdrop-blur-xl
    transition
  `;
    const variants = {
        default: `
      bg-white/[0.06]
      shadow-[0_8px_30px_rgba(0,0,0,0.35)]
      hover:bg-white/[0.08]
    `,
        panel: `
      bg-white/[0.04]
      hover:bg-white/[0.06]
    `,
        clickable: `
      bg-white/[0.06]
      hover:bg-white/[0.1]
      cursor-pointer
    `,
    };
    const padding = 'p-6';
    return (_jsxs("div", { onClick: onClick, className: `${base} ${variants[variant]} ${padding} ${className}`, children: [(header || right) && (_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("div", { className: "font-medium text-sm", children: header }), right] })), _jsx("div", { children: children }), actions && (_jsx("div", { className: "mt-4 flex justify-end gap-2", children: actions }))] }));
}
