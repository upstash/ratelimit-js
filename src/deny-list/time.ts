
// Number of milliseconds in one hour
const MILLISECONDS_IN_HOUR = 60 * 60 * 1000;

// Number of milliseconds in one day
const MILLISECONDS_IN_DAY = 24 * MILLISECONDS_IN_HOUR;

// Number of milliseconds from the current time to 2 AM UTC
const MILLISECONDS_TO_2AM = 2 * MILLISECONDS_IN_HOUR;

export const getIpListTTL = (time?: number) => {
  const now = time || Date.now();

  // Time since the last 2 AM UTC
  const timeSinceLast2AM = (now - MILLISECONDS_TO_2AM) % MILLISECONDS_IN_DAY;

  // Remaining time until the next 2 AM UTC
  return MILLISECONDS_IN_DAY - timeSinceLast2AM;
}
  