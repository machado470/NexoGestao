import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./_core/nexoClient', () => ({ nexoFetch: vi.fn() }));
import { nexoFetch } from './_core/nexoClient';
import { authedGetPage } from './_core/nexoTransport';

const meta = { page: 2, limit: 8, total: 501, pages: 63 };
describe('paginated BFF transport', () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    {data:[{id:'old'}],meta},
    {success:true,data:{data:[{id:'old'}],meta}},
    {success:true,data:{data:[{id:'old'}],pagination:meta}},
  ])('preserves API totals through nested envelopes', async payload => {
    vi.mocked(nexoFetch).mockResolvedValue(payload);
    expect(await authedGetPage({},'/customers',{page:2,limit:8})).toEqual({items:[{id:'old'}],meta});
    expect(nexoFetch).toHaveBeenCalledWith({},'/customers?page=2&limit=8');
  });
  it('rejects missing metadata instead of inventing totals from one page', async () => {
    vi.mocked(nexoFetch).mockResolvedValue({data:[{id:'old'}]});
    await expect(authedGetPage({},'/customers')).rejects.toThrow('metadados');
  });
  it('does not turn API errors into empty pages', async () => {
    vi.mocked(nexoFetch).mockResolvedValue({success:false,message:'Denied'});
    await expect(authedGetPage({},'/customers')).rejects.toThrow('Denied');
  });
});
