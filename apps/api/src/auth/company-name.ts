import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export const COMPANY_NAME_TAKEN_MESSAGE =
  'This company name is already registered. Use your exact registered company name, or contact support if your company already has an account.';

/** Collapse whitespace for storage; the key is the lowercased form used for uniqueness. */
export function companyNameFields(name: string | null | undefined): {
  companyName: string | null;
  companyNameKey: string | null;
} {
  const companyName = name?.replace(/\s+/g, ' ').trim() || null;
  return { companyName, companyNameKey: companyName ? companyName.toLowerCase() : null };
}

export async function assertCompanyNameAvailable(
  prisma: PrismaService,
  userId: string,
  companyNameKey: string | null,
): Promise<void> {
  if (!companyNameKey) return;
  const clash = await prisma.accountProfile.findFirst({
    where: { companyNameKey, NOT: { userId } },
    select: { id: true },
  });
  if (clash) throw new ConflictException(COMPANY_NAME_TAKEN_MESSAGE);
}

/** Maps the unique-index race (two saves at once) onto the same 409 as the pre-check. */
export function rethrowCompanyNameConflict(err: unknown): never {
  const target =
    err instanceof Prisma.PrismaClientKnownRequestError
      ? JSON.stringify(err.meta?.target ?? '')
      : '';
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    (target.includes('company_name_key') || target.includes('companyNameKey'))
  ) {
    throw new ConflictException(COMPANY_NAME_TAKEN_MESSAGE);
  }
  throw err;
}
