import { jsx as _jsx } from "react/jsx-runtime";
export default function Icon({ icon: IconComp, size = 18, className = '', }) {
    return (_jsx(IconComp, { size: size, className: `stroke-[1.75] opacity-60 ${className}` }));
}
