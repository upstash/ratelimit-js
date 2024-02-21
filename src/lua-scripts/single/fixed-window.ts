export const requestFixedWindowScript = `
local key     = KEYS[1]
local window  = ARGV[1]

local r = redis.call("INCR", key)
if r == 1 then 
-- The first time this key is set, the value will be 1.
-- So we only need the expire command once
redis.call("PEXPIRE", key, window)
end

return r`;

export const payloadFixedWindowScript = `
local key                 = KEYS[1]
local requestPayloadSize  = ARGV[1]
local window              = ARGV[2]

local r = redis.call("INCRBY", key, requestPayloadSize)
if r == requestPayloadSize then
-- The first time this key is set, the value will be equal to requestPayloadSize.
-- So we only need the expire command once
redis.call("PEXPIRE", key, window)
end

return r
`;


