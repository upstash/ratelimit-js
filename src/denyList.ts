import { Redis } from "./types"
import { RatelimitResponse } from "./types"

export const checkDenyList = async (redis: Redis, prefix: string, members: (string | undefined)[]) => {
  const definedMembers = members.filter(item => item !== undefined) as string[];
  
  if (definedMembers.length === 0) return false;

  const isMember = await redis.smismember(
    [prefix, "denyList", "all"].join(":"), definedMembers
  );

  return isMember.some((elem) => !!elem );
};

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
