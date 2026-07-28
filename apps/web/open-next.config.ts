import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Minimal config (no R2 incremental cache). Add R2 later if needed for ISR.
export default defineCloudflareConfig();
