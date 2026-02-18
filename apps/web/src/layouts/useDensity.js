import { useContext } from 'react';
import { DensityContext } from './densityContext';
export function useDensity() {
    const ctx = useContext(DensityContext);
    if (!ctx) {
        throw new Error('useDensity must be used inside DensityProvider');
    }
    return ctx;
}
