import { useEffect, useState } from 'react';
import { getExecutiveReport } from '../services/reports';
export function useExecutiveDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        getExecutiveReport()
            .then(setData)
            .finally(() => setLoading(false));
    }, []);
    return {
        loading,
        peopleStats: data?.peopleStats ?? { OK: 0, WARNING: 0, CRITICAL: 0 },
        correctiveOpenCount: data?.correctiveOpenCount ?? 0,
        people: data?.people ?? [],
        tracks: data?.tracks ?? [],
        timeline: data?.timeline ?? [],
    };
}
