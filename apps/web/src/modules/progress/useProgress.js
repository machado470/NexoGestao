import { api } from '../../lib/api';
import { useOrg } from '../organization/useOrg';
export function useProgress() {
    const { orgKey } = useOrg();
    async function setProgress(personId, trackId, value) {
        await api.post('/progress', {
            orgId: orgKey,
            personId,
            trackId,
            value,
        });
    }
    async function getProgress(personId, trackId) {
        const res = await api.get('/progress', {
            params: {
                orgId: orgKey,
                personId,
                trackId,
            },
        });
        return res.data.data?.value ?? 0;
    }
    return {
        setProgress,
        getProgress,
    };
}
