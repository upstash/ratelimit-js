 const requestSlidingWindowScript = `
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local tokens      = tonumber(ARGV[1]) -- tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
  if requestsInPreviousWindow + requestsInCurrentWindow >= tokens then
    return -1
  end

  local newValue = redis.call("INCR", currentKey)
  if newValue == 1 then 
    -- The first time this key is set, the value will be 1.
    -- So we only need the expire command once
    redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
  end
  return tokens - ( newValue + requestsInPreviousWindow )
  `;

const payloadSlidingWindowScript = `
  local currentKey            = KEYS[1]           -- identifier including prefixes
  local previousKey           = KEYS[2]           -- key of the previous bucket
  local payloadLimit          = tonumber(ARGV[1]) -- payloadLimit per window
  local requestPayloadSize    = tonumber(ARGV[2]) -- current request payload size
  local now                   = ARGV[3]           -- current timestamp in milliseconds
  local window                = ARGV[4]           -- interval in milliseconds

  local totalPayloadSizeInCurrentWindow = redis.call("GET", currentKey)
  if totalPayloadSizeInCurrentWindow == false then
    totalPayloadSizeInCurrentWindow = 0
  end

  local totalPayloadSizeInPreviousWindow = redis.call("GET", previousKey)
  if totalPayloadSizeInPreviousWindow == false then
    totalPayloadSizeInPreviousWindow = 0
  end
  local percentageInCurrent = ( now % window ) / window
  -- weighted total payload size to consider from the previous window
  totalPayloadSizeInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * totalPayloadSizeInPreviousWindow)
  if totalPayloadSizeInPreviousWindow + totalPayloadSizeInCurrentWindow >= payloadLimit then
    return -1
  end

  local newValue = redis.call("INCRBY", currentKey, requestPayloadSize)
  if newValue == requestPayloadSize then 
    -- The first time this key is set, the value will be equal to requestPayloadSize.
    -- So we only need the expire command once
    redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
  end
  return payloadLimit - ( newValue + totalPayloadSizeInPreviousWindow )
  `;

