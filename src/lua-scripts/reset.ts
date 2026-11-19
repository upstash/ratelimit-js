export const resetScript = `
      local pattern = KEYS[1]

      -- When given, a key is only deleted if it is this text followed by a
      -- window number. Keys of other identifiers which start with the same
      -- text also match the pattern, and are left alone.
      local start = ARGV[1] or ""

      -- Initialize cursor to start from 0
      local cursor = "0"

      repeat
          -- Scan for keys matching the pattern
          local scan_result = redis.call('SCAN', cursor, 'MATCH', pattern)

          -- Extract cursor for the next iteration
          cursor = scan_result[1]

          -- Extract keys from the scan result
          local keys = scan_result[2]

          for i=1, #keys do
            local key = keys[i]
            if start == "" or (string.sub(key, 1, #start) == start and string.match(string.sub(key, #start + 1), "^%d+$")) then
              redis.call('DEL', key)
            end
          end

      -- Continue scanning until cursor is 0 (end of keyspace)
      until cursor == "0"
    `;
