import { getIpListTTL } from './time';
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";

describe('getIpListTTL', () => {
  test('returns correct TTL when it is before 2 AM UTC', () => {
    const before2AM = Date.UTC(2024, 5, 12, 1, 0, 0); // June 12, 2024, 1:00 AM UTC
    const expectedTTL = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

    expect(getIpListTTL(before2AM)).toBe(expectedTTL);
  });

  test('returns correct TTL when it is exactly 2 AM UTC', () => {
    const exactly2AM = Date.UTC(2024, 5, 12, 2, 0, 0); // June 12, 2024, 2:00 AM UTC
    const expectedTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    expect(getIpListTTL(exactly2AM)).toBe(expectedTTL);
  });

  test('returns correct TTL when it is after 2 AM UTC but before the next 2 AM UTC', () => {
    const after2AM = Date.UTC(2024, 5, 12, 3, 0, 0); // June 12, 2024, 3:00 AM UTC
    const expectedTTL = 23 * 60 * 60 * 1000; // 23 hours in milliseconds

    expect(getIpListTTL(after2AM)).toBe(expectedTTL);
  });

  test('returns correct TTL when it is much later in the day', () => {
    const laterInDay = Date.UTC(2024, 5, 12, 20, 0, 0); // June 12, 2024, 8:00 PM UTC
    const expectedTTL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

    expect(getIpListTTL(laterInDay)).toBe(expectedTTL);
  });

  test('returns correct TTL when it is exactly the next day', () => {
    const nextDay = Date.UTC(2024, 5, 13, 2, 0, 0); // June 13, 2024, 2:00 AM UTC
    const expectedTTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    expect(getIpListTTL(nextDay)).toBe(expectedTTL);
  });

  test('returns correct TTL when no time is provided (uses current time)', () => {
    const now = Date.now();
    const expectedTTL = getIpListTTL(now);

    expect(getIpListTTL()).toBe(expectedTTL);
  });
});
