import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import LayoutBase from '../components/layout/LayoutBase';
import Hero from '../modules/landing/Hero';
import Governance from '../modules/landing/Governance';
import HowItWorks from '../modules/landing/HowItWorks';
import Modules from '../modules/landing/Modules';
import ExecutivePreview from '../modules/landing/ExecutivePreview';
import Security from '../modules/landing/Security';
import CTA from '../modules/landing/CTA';
import Footer from '../modules/landing/Footer';
export default function Landing() {
    return (_jsxs(LayoutBase, { children: [_jsx(Hero, {}), _jsx(Governance, {}), _jsx(HowItWorks, {}), _jsx(Modules, {}), _jsx(ExecutivePreview, {}), _jsx(Security, {}), _jsx(CTA, {}), _jsx(Footer, {})] }));
}
