import { useEffect, useState } from 'react';
import api from '../services/api';
export function usePersonDetail(personId) {
    const [state, setState] = useState({
        person: null,
        loading: true,
        error: null,
    });
    useEffect(() => {
        if (!personId) {
            setState({ person: null, loading: false, error: null });
            return;
        }
        let alive = true;
        api
            .get(`/people/${personId}`)
            .then(res => {
            if (!alive)
                return;
            setState({ person: res.data, loading: false, error: null });
        })
            .catch(err => {
            if (!alive)
                return;
            setState({
                person: null,
                loading: false,
                error: err?.response?.data?.error?.message ??
                    err?.message ??
                    'Erro ao carregar pessoa',
            });
        });
        return () => {
            alive = false;
        };
    }, [personId]);
    return state;
}
export default usePersonDetail;
