import { randomBytes, randomInt } from 'node:crypto';

/** Crockford-ish alphabet: no I, O, 0 or 1, so a reference survives being read aloud. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const REFERENCE_LENGTH = 8;

/**
 * Human-quotable booking code, e.g. "BK-7F3K9Q2A".
 *
 * This is NOT a secret - it appears in emails and gets read over the phone.
 * Anything that authorises an action must use the cancellation token instead.
 */
export const generateBookingReference = (): string => {
  let code = '';
  for (let index = 0; index < REFERENCE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `BK-${code}`;
};

/**
 * Bearer credential for the emailed cancel link. 32 random bytes, because it is
 * the only thing standing between a stranger and someone else's booking - never
 * derive it from the reference, the id, or a timestamp.
 */
export const generateCancellationToken = (): string => randomBytes(32).toString('hex');
