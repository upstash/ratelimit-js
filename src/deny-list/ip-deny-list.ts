import { DenyListExtension, IpDenyListKey, IpDenyListStatusKey, Redis } from "../types"
import { getIpListTTL } from "./time"

const baseUrl = "https://raw.githubusercontent.com/stamparm/ipsum/master/levels"

export class ThresholdError extends Error {
  constructor(threshold: number) {
    super(`Allowed threshold values are from 1 to 8, 1 and 8 included. Received: ${threshold}`);
    this.name = "ThresholdError";
  }
}

/**
 * Fetches the ips from the ipsum.txt at github
 * 
 * In the repo we are using, 30+ ip lists are aggregated. The results are
 * stores in text files from 1 to 8.
 * https://github.com/stamparm/ipsum/tree/master/levels
 * 
 * X.txt file holds ips which are in at least X of the lists.
 *
 * @param threshold ips with less than or equal to the threshold are not included
 * @returns list of ips
 */
const getIpDenyList = async (threshold: number) => {
  if (typeof threshold !== "number" || threshold < 1 || threshold > 8) {
    throw new ThresholdError(threshold)
  }

  try {
    // Fetch data from the URL
    const response = await fetch(`${baseUrl}/${threshold}.txt`)
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`)
    }
    const data = await response.text()

    // Process the data
    const lines = data.split("\n")
    return lines.filter((value) => value.length > 0) // remove empty values
  } catch (error) {
    throw new Error(`Failed to fetch ip deny list: ${error}`)
  }
}

/**
 * Gets the list of ips from the github source which are not in the
 * deny list already
 *
 * @param redis redis instance
 * @param prefix ratelimit prefix
 * @param threshold ips with less than or equal to the threshold are not included
 * @param ttl time to live in milliseconds for the status flag. Optional. If not
 *  passed, ttl is infferred from current time.
 * @returns list of ips which are not in the deny list
 */
export const updateIpDenyList = async (
  redis: Redis,
  prefix: string,
  threshold: number,
  ttl?: number
) => {
  const allIps = await getIpDenyList(threshold)

  const allDenyLists = [prefix, DenyListExtension, "all"].join(":")
  const ipDenyList = [prefix, DenyListExtension, IpDenyListKey].join(":")
  const statusKey = [prefix, IpDenyListStatusKey].join(":")

  const transaction = redis.multi()

  // remove the old ip deny list from the all set
  transaction.sdiffstore(allDenyLists, allDenyLists, ipDenyList)

  // delete the old ip deny list and create new one
  transaction.del(ipDenyList)
  transaction.sadd(ipDenyList, ...allIps)

  // make all deny list and ip deny list disjoint by removing duplicate
  // ones from ip deny list
  transaction.sdiffstore(ipDenyList, ipDenyList, allDenyLists)

  // add remaining ips to all list
  transaction.sunionstore(allDenyLists, allDenyLists, ipDenyList)

  // set status key with ttl
  transaction.set(statusKey, "valid", {px: ttl ?? getIpListTTL()})

  return await transaction.exec()
}

export const disableIpDenyList = async (redis: Redis, prefix: string) => {
  const allDenyListsKey = [prefix, DenyListExtension, "all"].join(":")
  const ipDenyListKey = [prefix, DenyListExtension, IpDenyListKey].join(":")
  const statusKey = [prefix, IpDenyListStatusKey].join(":")

  const transaction = redis.multi()

  // remove the old ip deny list from the all set
  transaction.sdiffstore(allDenyListsKey, allDenyListsKey, ipDenyListKey)

  // delete the old ip deny list
  transaction.del(ipDenyListKey)

  // set to disabled
  // this way, the TTL command in checkDenyListScript will return -1.
  transaction.set(statusKey, "disabled")

  return await transaction.exec()
}
