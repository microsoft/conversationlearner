/**
 * Copyright (c) Microsoft Corporation. All rights reserved.  
 * Licensed under the MIT License.
 */
export class KeyGen {
  public static MakeKey(address: string) {
    return this.HashCode(address).toString()
  }

  private static HashCode(text: string): number {
    let hash = 0
    let i = undefined
    let chr = undefined

    if (text.length === 0) return hash
    for (i = 0; i < text.length; i++) {
      chr = text.charCodeAt(i)
      hash = (hash << 5) - hash + chr
      hash |= 0 // Convert to 32bit integer
    }
    return hash
  }
}
