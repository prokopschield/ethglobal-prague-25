import { createFetch } from 'openapi-hooks';

import type { paths } from './schema.gen';

export const baseUrl = new URL('https://eth.blockscout.com/api/v2/');

export const useApi = createFetch<paths>({
    baseUrl,
    onError(error: { status: number }) {
        if (error.status === 429) {
            console.error('Rate limit exceeded');
        }
    },
});
