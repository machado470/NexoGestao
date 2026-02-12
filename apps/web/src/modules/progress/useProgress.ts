import { api } from '../../lib/api'
import { useOrg } from '../organization/useOrg'

export function useProgress() {
  const { orgKey } = useOrg()

  async function setProgress(
    personId: string,
    trackId: string,
    value: number,
  ) {
    await api.post('/progress', {
      orgId: orgKey,
      personId,
      trackId,
      value,
    })
  }

  async function getProgress(
    personId: string,
    trackId: string,
  ): Promise<number> {
    const res = await api.get('/progress', {
      params: {
        orgId: orgKey,
        personId,
        trackId,
      },
    })

    return res.data.data?.value ?? 0
  }

  return {
    setProgress,
    getProgress,
  }
}
