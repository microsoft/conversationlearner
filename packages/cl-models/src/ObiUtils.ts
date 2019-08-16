/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export interface LGItem {
    text: string,
    suggestions: string[]
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

    public static parseLGString(text: string, lgMap: Map<string, LGItem>): void {
        const items = text.split('# ')
        for (let item of items) {
            item = item.trim()
            if (item.length === 0) continue
            const key = item.substring(0, findFirstOrThrow(item, "-")).trim()
            const backticksStart = findFirstOrThrow(item, "```")
            const suggestionsStart = findLastOrThrow(item, "[")
            if (backticksStart > suggestionsStart) throw new RangeError('``` not found')
            const body = item.substring(backticksStart + 3, suggestionsStart).trim()
            const suggestionTag = "[Suggestions="
            const suggestionList = item.substring(
                findLastOrThrow(item, suggestionTag) + suggestionTag.length,
                findLastOrThrow(item, "]"))
            const suggestions = suggestionList.length > 0 ? suggestionList.split('|') : []
            const lgItem: LGItem = {
                text: body,
                suggestions
            }
            lgMap.set(key, lgItem)
        }
    }
}
