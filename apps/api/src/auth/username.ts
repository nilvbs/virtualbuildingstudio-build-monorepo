import type { PrismaService } from '../prisma/prisma.service';

const USERNAME_MAX = 48;

/** Strip accents and keep lowercase a-z0-9 only. */
export function slugifyNamePart(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: 'User', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

export function composeFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim() || 'User';
}

export function baseUsernameFromName(firstName: string, lastName: string): string {
  const first = slugifyNamePart(firstName) || 'user';
  const last = slugifyNamePart(lastName);
  const base = last ? `${first}.${last}` : first;
  return base.slice(0, USERNAME_MAX) || 'user';
}

/**
 * Allocate a unique username from first + last name.
 * Tries `jane.doe`, then `jane.doe2`, `jane.doe3`, …
 */
export async function allocateUsername(
  prisma: PrismaService,
  firstName: string,
  lastName: string,
): Promise<string> {
  const base = baseUsernameFromName(firstName, lastName);
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base.slice(0, USERNAME_MAX - String(i + 1).length)}${i + 1}`;
    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base.slice(0, USERNAME_MAX - suffix.length - 1)}_${suffix}`;
}

export type PersonNameFields = {
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
};

export async function buildPersonNameFields(
  prisma: PrismaService,
  input: { firstName: string; lastName: string } | { fullName: string },
): Promise<PersonNameFields> {
  const names =
    'firstName' in input
      ? { firstName: input.firstName.trim(), lastName: input.lastName.trim() }
      : splitFullName(input.fullName);
  const firstName = names.firstName || 'User';
  const lastName = names.lastName;
  const fullName = composeFullName(firstName, lastName);
  const username = await allocateUsername(prisma, firstName, lastName);
  return { firstName, lastName, fullName, username };
}
