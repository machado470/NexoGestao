import { useEffect, useState } from 'react';
import api from '../services/api';
export function usePeople() {
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    async function load() {
        setLoading(true);
        try {
            const res = await api.get('/persons');
            setPeople(res.data.data ?? res.data);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load();
    }, []);
    return {
        people,
        loading,
        reload: load,
    };
}
