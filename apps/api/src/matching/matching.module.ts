import { Module } from '@nestjs/common';

/**
 * Matching module — the admin-driven manual match action and match lifecycle.
 * Phase 1 matching is done by a human; no automated/algorithmic matching.
 * Feature behavior lands in build step 5. Boundary only for now.
 */
@Module({})
export class MatchingModule {}
