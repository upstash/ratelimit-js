export const fixedWindowLimitScript = `
  local key           = KEYS[1]
  local window        = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == tonumber(incrementBy) then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end

  return r
`;

export const fixedWindowRemainingTokensScript = `
      local key = KEYS[1]
      local tokens = 0

      local value = redis.call('GET', key)
      if value then
          tokens = value
      end
      return tokens
    `;

export const slidingWindowLimitScript = `
  local key         = KEYS[1]           -- identifier including prefixes
  local tokens      = tonumber(ARGV[1]) -- tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds
  local incrementBy = ARGV[4]           -- increment rate per request at a given value, default is 1
  
  -- following block is equivalent to, but less commands than "GET" + "INCRBY"
  local value = redis.pcall("INCRBY", key, incrementBy)
  -- by design, blocked keys hold non-integer string, see below. So above command might throw error
  if type(value) ~= "number" then return -1 end
  value = value - incrementBy    -- pre-existing value or 0
  
  -- extract info by decoding value. To understand the encoding, see newValue definition below
  local requestsInCurrentWindow = value % tokens
  local valueByTokens = math.floor(value / tokens)
  local requestsInPreviousWindow = valueByTokens % tokens
  local bitRepresentingWindow = math.floor(valueByTokens / tokens)
  local currWinIndex = math.floor(now / window)
  local currWinMod2 = currWinIndex % 2
  local needsReset = bitRepresentingWindow ~= currWinMod2 or value == 0
  
  local newValue
  if needsReset then
    requestsInPreviousWindow = requestsInCurrentWindow
    requestsInCurrentWindow = incrementBy
    newValue = (currWinMod2*tokens + requestsInPreviousWindow)*tokens + requestsInCurrentWindow
  else
    requestsInCurrentWindow = requestsInCurrentWindow + incrementBy
  end
  
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
  local remaining = tokens - ( requestsInPreviousWindow + requestsInCurrentWindow )

  if remaining <= 0 then
    local reset = ( currWinIndex + 1 ) * window    -- expire by next window
    -- set a string at key so that next "INCRBY" throws error
    redis.call("SET", key, "BLOCKED!", "PXAT", reset)
  elseif needsReset then
    local reset = ( currWinIndex + 2 ) * window    -- live for another window
    redis.call("SET", key, newValue, "PXAT", reset)   -- store value encoding new info
  end

  return remaining
`;

export const slidingWindowRemainingTokensScript = `
  local key         = KEYS[1]           -- identifier including prefixes
  local tokens      = tonumber(ARGV[1]) -- tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds
  
  local value = redis.call("GET", key) or 0 -- value is 0 when key doesn't exist
  -- by design, blocked keys hold non-integer string
  if tonumber(value) == nil then return 0 end
  
  -- extract info by decoding value
  local requestsInCurrentWindow = value % tokens
  local valueByTokens = math.floor(value / tokens)
  local requestsInPreviousWindow = valueByTokens % tokens
  local bitRepresentingWindow = math.floor(valueByTokens / tokens)
  local currWinIndex = math.floor(now / window)
  local currWinMod2 = currWinIndex % 2
  local needsReset = bitRepresentingWindow ~= currWinMod2 or value == 0
  
  if needsReset then
    requestsInPreviousWindow = requestsInCurrentWindow
    requestsInCurrentWindow = 0
  end
  
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
  return tokens - ( requestsInPreviousWindow + requestsInCurrentWindow )
`;

export const tokenBucketLimitScript = `
  local key         = KEYS[1]           -- identifier including prefixes
  local maxTokens   = tonumber(ARGV[1]) -- maximum number of tokens
  local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
  local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
  local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
  local incrementBy = tonumber(ARGV[5]) -- how many tokens to consume, default is 1
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")
        
  local refilledAt
  local tokens

  if bucket[1] == false then
    refilledAt = now
    tokens = maxTokens
  else
    refilledAt = tonumber(bucket[1])
    tokens = tonumber(bucket[2])
  end
        
  if now >= refilledAt + interval then
    local numRefills = math.floor((now - refilledAt) / interval)
    tokens = math.min(maxTokens, tokens + numRefills * refillRate)

    refilledAt = refilledAt + numRefills * interval
  end

  if tokens == 0 then
    return {-1, refilledAt + interval}
  end

  local remaining = tokens - incrementBy
  local expireAt = math.ceil(((maxTokens - remaining) / refillRate)) * interval
        
  redis.call("HSET", key, "refilledAt", refilledAt, "tokens", remaining)
  redis.call("PEXPIRE", key, expireAt)
  return {remaining, refilledAt + interval}
`;

export const tokenBucketIdentifierNotFound = -1

export const tokenBucketRemainingTokensScript = `
  local key         = KEYS[1]
  local maxTokens   = tonumber(ARGV[1])
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")

  if bucket[1] == false then
    return {maxTokens, ${tokenBucketIdentifierNotFound}}
  end
        
  return {tonumber(bucket[2]), tonumber(bucket[1])}
`;

export const cachedFixedWindowLimitScript = `
  local key     = KEYS[1]
  local window  = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == incrementBy then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end
      
  return r
`;

export const cachedFixedWindowRemainingTokenScript = `
  local key = KEYS[1]
  local tokens = 0

  local value = redis.call('GET', key)
  if value then
      tokens = value
  end
  return tokens
`;
