import { jsx as _jsx } from "react/jsx-runtime";
export default function IconBase({ size = 20, children, ...props }) {
    return (_jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", ...props, children: children }));
}
