import { ClientMemoryManager, ReadOnlyClientMemoryManager } from 'clwoz-sdk'
import { Train, RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, LuisSlot, Domain, NameSubstitutionMap } from './dataTypes'
import * as DB from './database'
import * as BB from 'botbuilder'

// Apply substitutions (i.e. "0-star" = "0")
export const ApplyEntitySubstitutions = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    Object.values(LuisSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
        if (value) {
            var substitution = DB.EntitySubstitutions()[value]
            if (substitution) {
                memoryManager.Set(entityName, substitution)
                return substitution
            }
            else if (domainFilter) {
                var newValue = DB.ResolveEntityValue(value, entityName, domainFilter)
                if (newValue != value) {
                    memoryManager.Set(entityName, substitution)
                    return substitution
                }
            }
            if (value.startsWith("the ")) {
                value.substring("the ".length)
            }
        }
    })
}

export const ExpandTime = (time: string, addHours: number = 0): string => {
    var parts = time.split(":")
    var hour = +parts[0] + addHours
    var min = parts[1] ? parts[1] : "00"
    return `${hour}:${min}`
}
export const ProcessTime = (time: string): string => {
    if (time.endsWith("PM") || time.endsWith("pm")) {
        var cleanTime = time.substr(0, time.length - 2)
        return ExpandTime(cleanTime, 12)
    }
    if (time.endsWith("AM") || time.endsWith("am")) {
        var cleanTime = time.substr(0, time.length - 2)
        return ExpandTime(cleanTime, 12)
    }
    return ExpandTime(time)
}

// Return version of string with no puncuation or space and lowercase
export var BaseString = (text: string): string => {
    return text.replace(/[^\w\s]|_/g, "").replace(/\s/g, "").toLowerCase()
}

export var MemoryValues = (slot: any, memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): string[] => {
    return memoryManager.Get(slot, ClientMemoryManager.AS_STRING_LIST)
        .map(i => BaseString(i))
        .filter(i => i != "none" && i != "dontcare")
}

export var trainArriveBefore = (trains: Train[], arriveBefore: string): Train | null => {

    var arriveBeforeTime = parseTime(arriveBefore)
    var bestTime = Number.MAX_VALUE
    var bestTrain: Train | null = null
    trains.forEach(train => {
        var trainLeave = parseTime(train.leaveAt)
        var diff = arriveBeforeTime - trainLeave
        if (diff > 0 && diff < bestTime) {
            bestTrain = train
            bestTime = diff
        }
    })
    return bestTrain
}

export var trainLeaveAfter = (trains: Train[], leaveAfter: string): Train | null => {

    var leaveAfterTime = parseTime(leaveAfter)
    var bestTime = Number.MAX_VALUE
    var bestTrain: Train | null = null
    trains.forEach(train => {
        var trainLeave = parseTime(train.leaveAt)
        var diff = trainLeave - leaveAfterTime
        if (diff > 0 && diff < bestTime) {
            bestTrain = train
            bestTime = diff
        }
    })
    return bestTrain
}

export var parseTime = (time: string): number => {
    var parts = time.split(":")
    return (parseInt(parts[0]) * 60) + parseInt(parts[1])
}

export const ActivityResultToString = (activityResult: DB.ActivityResult): string => {
    let dialogActs: string[] = []
    let entities: string[] = []
    let output: string[][] = []
    activityResult.modelResults.forEach(dr => {
        if (dr) {
            dialogActs = [...dialogActs, ...dr.dialogActs]
            entities = [...entities, ...dr.entities]
            output = output.concat(dr.output)
        }
    })
    //return `${dialogActs.join(",")} ${entities.join(",")}`
    return JSON.stringify(output)
}

export const makeId = (length: number): string => {
    var result = ''
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    var charactersLength = characters.length
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

export const expandedResults = (dialogActs: string[], entities: string[]): string[][] => {
    const results: string[][] = []
    for (var dialogAct of dialogActs) {
        var parts = dialogAct.split('-')
        const domain = parts[0]
        const act = parts[1]
        const entity = parts[2]

        if (act == "request") {
            results.push([act, domain, entity, "?"])
        }
        else if (entity == "none") {
            results.push([act, domain, entity, "none"])
        }
        else if (entity == "Ref") {
            results.push([act, domain, entity, makeId(8)])
        }
        else {
            const kv = entities.find(e => e.includes(entity.toLowerCase()))
            // "attraction-semi-area: east,centre,south,west,north"
            const values = kv ? kv.split(": ")[1].split(",") : ["MISSING"]
            for (var value of values) {
                results.push([act, domain, entity, value])
            }
        }
    }
    return results
}

export const domainNameFromDialogAct = (dialogActName: string): string => {
    return dialogActName.split("-")[0].split("2")[0]
}

export const shortName = (entityName: string): string => {
    const split = entityName.split('-')
    let shortName = split[split.length - 1]
    shortName = NameSubstitutionMap.get(shortName) || shortName
    return shortName
}

export const propertyName = (entityName: string): string => {
    const split = entityName.split('-')
    let shortName = split[split.length - 1]
    NameSubstitutionMap.forEach((value: string, key: string) => {
        if (value == entityName) {
            return key
        }
    })
    return shortName
}

export const getSlotNames = (domain: Domain) => {
    switch (domain) {
        case Domain.ATTRACTION:
            return Object.values(AttractionSlot)
        case Domain.HOTEL:
            return Object.values(HotelSlot)
        case Domain.RESTAURANT:
            return Object.values(RestaurantSlot)
        case Domain.TAXI:
            return Object.values(TaxiSlot)
        case Domain.TRAIN:
            return Object.values(TrainSlot)
    }
}

export const GenerateGUID = (): string => {
    let d = new Date().getTime()
    let guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
        let r = ((d + Math.random() * 16) % 16) | 0
        d = Math.floor(d / 16)
        return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    return guid
}

export function levenshtein(a: string, b: string): number {
    const an = a ? a.length : 0
    const bn = b ? b.length : 0
    if (an === 0) {
        return bn
    }
    if (bn === 0) {
        return an
    }
    const matrix = new Array<number[]>(bn + 1)
    for (let i = 0; i <= bn; ++i) {
        let row = matrix[i] = new Array<number>(an + 1)
        row[0] = i
    }
    const firstRow = matrix[0]
    for (let j = 1; j <= an; ++j) {
        firstRow[j] = j
    }
    for (let i = 1; i <= bn; ++i) {
        for (let j = 1; j <= an; ++j) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            }
            else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1], // substitution
                    matrix[i][j - 1], // insertion
                    matrix[i - 1][j] // deletion
                ) + 1
            }
        }
    }
    return matrix[bn][an]
};


export const MakeUserActivity = (userInput: string, conversationId: string) => {

    // LARS transcript name?
    const testId = GenerateGUID()

    const conversation: BB.ConversationAccount = {
        id: conversationId,
        isGroup: false,
        name: "",
        tenantId: "",
        aadObjectId: "",
        role: BB.RoleTypes.User,
        conversationType: ""
    }
    const fromAccount: BB.ChannelAccount = {
        name: "cltest", //Utils.CL_DEVELOPER,
        id: testId,
        role: BB.RoleTypes.User,
        aadObjectId: ''
    }

    const activity = {  //directline.Activity
        id: GenerateGUID(),
        conversation,
        type: BB.ActivityTypes.Message,
        text: userInput,
        from: fromAccount,
        channelData: {}
    }

    return activity
}


