/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export interface LGItem {
    lgName: string,
    actionId?: string
    text: string,
    suggestions: string[]
    hash?: string
}

const findOrThrow = (haystack_fn: (s: string) => number, needle: string): number => {
    const i = haystack_fn(needle)
    if (i === -1) throw new RangeError(`${needle} not found`)
    return i
}

/**
 * Finds the index of the first instance of needle in haystack, or throws an exception if not found.
 */
const findFirstOrThrow = (haystack: string, needle: string): number => {
    return findOrThrow(haystack.indexOf.bind(haystack), needle)
}

/**
 * Finds the index of the last instance of needle in haystack, or throws an exception if not found.
 */
const findLastOrThrow = (haystack: string, needle: string): number => {
    return findOrThrow(haystack.lastIndexOf.bind(haystack), needle)
}

/**
 * Parses OBI .dialog files from custom format into structured data.
 */
export class ObiUtils {

    public static addToLGMap(text: string, lgMap: LGItem[]): void {
        const items = text.split('# ')
        for (let item of items) {
            item = item.trim()
            if (item.length === 0) {
                continue
            }
            const lgName = item.substring(0, findFirstOrThrow(item, "-")).trim()
            const backticksStart = findFirstOrThrow(item, "```")
            const suggestionsStart = findLastOrThrow(item, "[")
            if (backticksStart > suggestionsStart) 
            {
                throw new RangeError('``` not found')
            }

            const body = item.substring(backticksStart + 3, suggestionsStart).trim()
            const suggestionTag = "[Suggestions="
            const suggestionList = item.substring(
                findLastOrThrow(item, suggestionTag) + suggestionTag.length,
                findLastOrThrow(item, "]"))
            const suggestions = suggestionList.length > 0 ? suggestionList.split('|') : []
            const lgItem: LGItem = {
                lgName,
                text: body,
                suggestions,
                hash: hashText(body)
            }
            lgMap.push(lgItem)
        }
    }
}

// Calculate a 32 bit FNV-1a hash
// Ref.: http://isthe.com/chongo/tech/comp/fnv/
export function hashText(text: string) {
    // tslint:disable:no-bitwise
    let l = text.length
    let hval = 0x811C9DC5  // seed

    for (let i = 0; i < l; i = i + 1) {
        hval ^= text.charCodeAt(i)
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24)
    }

    // Return 8 digit hex string
    return `0000000${(hval >>> 0).toString(16)}`.substr(-8)
}
