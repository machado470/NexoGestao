import { useEffect, useState } from 'react';
import { listMyAssignments, } from '../services/assignments';
export function useMyAssignments() {
    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState([]);
    async function load() {
        setLoading(true);
        try {
            const data = await listMyAssignments();
            setAssignments(data);
        }
        catch {
            setAssignments([]);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load();
    }, []);
    return {
        loading,
        assignments,
        reload: load,
    };
}
