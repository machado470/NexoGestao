import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { DensityContext } from './densityContext';
export function DensityProvider({ children, }) {
    const [density, setDensity] = useState('comfortable');
    return (_jsx(DensityContext.Provider, { value: { density, setDensity }, children: children }));
}
