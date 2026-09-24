import { HttpException, HttpStatus } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/** 1 initial send + 3 resends, then 1h lockout. */
export const OTP_MAX_SENDS_PER_WINDOW = 4;
export const OTP_COOLDOWN_MS = 30_000;
export const OTP_LOCKOUT_MS = 60 * 60 * 1000;

export type OtpSendChannel = 'email' | 'work_email' | 'phone';

export type OtpSendBlocked = {
  code: 'OTP_COOLDOWN' | 'OTP_LOCKOUT';
  message: string;
  retryAfterSec: number;
  unlockAt?: string;
  sendsUsed: number;
  sendsRemaining: number;
};

export type OtpChannelLockout = {
  channel: OtpSendChannel;
  locked: boolean;
  sendsUsed: number;
  unlockAt: string | null;
};

async function otpWindowStart(prisma: PrismaService, userId: string): Promise<Date> {
  const windowStart = new Date(Date.now() - OTP_LOCKOUT_MS);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { otpUnlockedAt: true },
  });
  const unlockedAt = user?.otpUnlockedAt;
  if (unlockedAt && unlockedAt.getTime() > windowStart.getTime()) {
    return unlockedAt;
  }
  return windowStart;
}

async function recentOtpSends(
  prisma: PrismaService,
  userId: string,
  channel: OtpSendChannel,
): Promise<Date[]> {
  const since = await otpWindowStart(prisma, userId);
  const rows = await prisma.contactOtp.findMany({
    where: { userId, channel, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  return rows.map((r) => r.createdAt);
}

/**
 * Enforce OTP send pacing: 30s between codes, max 4 sends / hour / channel,
 * then lock until 1h after the 4th send (unless admin set otpUnlockedAt).
 */
export async function assertOtpSendAllowed(
  prisma: PrismaService,
  userId: string,
  channel: OtpSendChannel,
): Promise<void> {
  const createdAts = await recentOtpSends(prisma, userId, channel);

  if (createdAts.length >= OTP_MAX_SENDS_PER_WINDOW) {
    const fourth = createdAts[OTP_MAX_SENDS_PER_WINDOW - 1]!;
    const unlockAtMs = fourth.getTime() + OTP_LOCKOUT_MS;
    if (Date.now() < unlockAtMs) {
      const retryAfterSec = Math.max(1, Math.ceil((unlockAtMs - Date.now()) / 1000));
      throwOtpBlocked({
        code: 'OTP_LOCKOUT',
        message: `Too many verification codes. Verification is paused for ${formatDuration(retryAfterSec)}. Open a support ticket if you still need help.`,
        retryAfterSec,
        unlockAt: new Date(unlockAtMs).toISOString(),
        sendsUsed: createdAts.length,
        sendsRemaining: 0,
      });
    }
  }

  const latest = createdAts[createdAts.length - 1];
  if (latest) {
    const elapsed = Date.now() - latest.getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      const retryAfterSec = Math.max(1, Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000));
      const used = createdAts.length;
      const remaining = Math.max(0, OTP_MAX_SENDS_PER_WINDOW - used);
      throwOtpBlocked({
        code: 'OTP_COOLDOWN',
        message: `Please wait ${retryAfterSec}s before requesting another code.`,
        retryAfterSec,
        sendsUsed: used,
        sendsRemaining: remaining,
      });
    }
  }
}

/**
 * After max sends in the window, block verify attempts until unlock.
 */
export async function assertOtpVerifyAllowed(
  prisma: PrismaService,
  userId: string,
  channel: OtpSendChannel,
): Promise<void> {
  const createdAts = await recentOtpSends(prisma, userId, channel);
  if (createdAts.length < OTP_MAX_SENDS_PER_WINDOW) return;

  const fourth = createdAts[OTP_MAX_SENDS_PER_WINDOW - 1]!;
  const unlockAtMs = fourth.getTime() + OTP_LOCKOUT_MS;
  if (Date.now() >= unlockAtMs) return;

  const retryAfterSec = Math.max(1, Math.ceil((unlockAtMs - Date.now()) / 1000));
  throwOtpBlocked({
    code: 'OTP_LOCKOUT',
    message: `Verification is paused for ${formatDuration(retryAfterSec)} after too many code requests. Open a support ticket if you need help.`,
    retryAfterSec,
    unlockAt: new Date(unlockAtMs).toISOString(),
    sendsUsed: createdAts.length,
    sendsRemaining: 0,
  });
}

/** Call after a successful OTP create — returns lockout info when the 4th send just landed. */
export async function getOtpLockoutIfActive(
  prisma: PrismaService,
  userId: string,
  channel: OtpSendChannel,
): Promise<{ unlockAt: Date; sendsUsed: number } | null> {
  const createdAts = await recentOtpSends(prisma, userId, channel);
  if (createdAts.length < OTP_MAX_SENDS_PER_WINDOW) return null;
  const fourth = createdAts[OTP_MAX_SENDS_PER_WINDOW - 1]!;
  const unlockAtMs = fourth.getTime() + OTP_LOCKOUT_MS;
  if (Date.now() >= unlockAtMs) return null;
  return { unlockAt: new Date(unlockAtMs), sendsUsed: createdAts.length };
}

export async function listOtpChannelLockouts(
  prisma: PrismaService,
  userId: string,
): Promise<OtpChannelLockout[]> {
  const channels: OtpSendChannel[] = ['email', 'phone', 'work_email'];
  const out: OtpChannelLockout[] = [];
  for (const channel of channels) {
    const createdAts = await recentOtpSends(prisma, userId, channel);
    const sendsUsed = createdAts.length;
    let unlockAt: string | null = null;
    let locked = false;
    if (sendsUsed >= OTP_MAX_SENDS_PER_WINDOW) {
      const fourth = createdAts[OTP_MAX_SENDS_PER_WINDOW - 1]!;
      const unlockAtMs = fourth.getTime() + OTP_LOCKOUT_MS;
      if (Date.now() < unlockAtMs) {
        locked = true;
        unlockAt = new Date(unlockAtMs).toISOString();
      }
    }
    out.push({ channel, locked, sendsUsed, unlockAt });
  }
  return out;
}

function throwOtpBlocked(body: OtpSendBlocked): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      ...body,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m} min`;
  return `${totalSec}s`;
}
