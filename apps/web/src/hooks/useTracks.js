import { useEffect, useState } from 'react';
import api from '../services/api';
export function useTracks() {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    async function load() {
        setLoading(true);
        try {
            const res = await api.get('/tracks');
            setTracks(res.data.data ?? res.data);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load();
    }, []);
    return {
        tracks,
        loading,
        reload: load,
    };
}
