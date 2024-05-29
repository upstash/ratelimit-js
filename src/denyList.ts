import { Redis } from "./types"
import { RatelimitResponse } from "./types"
import { Cache } from "./cache";


const denyListCache = new Cache(new Map());

/**
 * Checks items in members list and returns true if any
 * of them are in denyListCache.
 * 
 * @param members list of values to check against the cache
 * @returns true if identifier is blocked
 */
export const checkDenyListCache = (members: string[]) => {
  console.log(
    members,
    denyListCache,
    members.map(
      member => denyListCache.isBlocked(member).blocked
    )
  )
  return members.map(
    member => denyListCache.isBlocked(member).blocked
  ).some(elem => !!elem)
}

/**
 * Blocks a member for 1 minute.
 * 
 * If there are more than 1000 elements in the cache, empties
 * it so that the cache doesn't grow in size indefinetely.
 * 
 * @param member member to block
 */
const blockMember = (member: string) => {
  if (denyListCache.size() > 1000) denyListCache.empty();
  denyListCache.blockUntil(member, Date.now() + 60000);
}

/**
 * Checks if identifier or any of the values are in any of
 * the denied lists in Redis.
 * 
 * If some value is in a deny list, we block the identifier for a minute.
 * 
 * @param redis redis client
 * @param prefix ratelimit prefix
 * @param members List of values (identifier, ip, user agent, country)
 * @returns 
 */
export const checkDenyList = async (
  redis: Redis,
  prefix: string,
  members: string[]
) => {
  const deniedMembers = await redis.smismember(
    [prefix, "denyList", "all"].join(":"),
    members
  );

  let requestDenied = false;
  deniedMembers.map((memberDenied, index) => {
    if (memberDenied) {
      requestDenied = true;
      blockMember(members[index])
    }
  })

  return requestDenied;
};

/**
 * Overrides the rate limit response if deny list
 * response indicates that value is in deny list.
 * 
 * @param ratelimitResponse 
 * @param denyListResponse 
 * @returns 
 */
export const resolveResponses = (
  ratelimitResponse: RatelimitResponse,
  denyListResponse: boolean
) => {
  if (denyListResponse) {
    ratelimitResponse.success = false;
    ratelimitResponse.remaining = 0;
    ratelimitResponse.reason = "denyList";
  }
  return ratelimitResponse;
};

/**
 * 
 * @returns Default response to return when some item
 *  is in deny list.
 */
export const defaultDeniedResponse = (): RatelimitResponse => {
  return {
    success: false,
    limit: 0,
    remaining: 0,
    reset: 0,
    pending: Promise.resolve(),
    reason: "denyList"
  }
}
