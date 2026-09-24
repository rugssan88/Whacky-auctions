import type { Config } from '@netlify/functions';
import { closeExpiredAuctions, ensureBootstrapAdmin } from './lib/core.mts';
export default async () => { await ensureBootstrapAdmin(); await closeExpiredAuctions(); };
export const config: Config = { schedule: '0 * * * *' };
