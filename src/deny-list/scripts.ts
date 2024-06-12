export const checkDenyListScript = `
  local allDenyListsKey     = KEYS[1]
  local ipDenyListStatusKey = KEYS[2]

  local results = redis.call('SMISMEMBER', allDenyListsKey, unpack(ARGV))
  local status  = redis.call('TTL', ipDenyListStatusKey)

  -- if status == -1, then deny list is disabled
  -- if status == -2, then status flag has expired
  if status == -2 then
    redis.call('SETEX', ipDenyListStatusKey, 30, "pending")
  end

  return { results, status }
`