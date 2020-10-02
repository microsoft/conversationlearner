import { ClientMemoryManager, ReadOnlyClientMemoryManager } from 'clwoz-sdk'
import { Train, RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, PoliceSlot, HospitalSlot, LuisSlot, Domain, NameSubstitutionMap } from './dataTypes'
import * as DB from './database'
import * as BB from 'botbuilder'

// Max number of items allowed to set in multi-value
export const MAX_MULTI_VALUE = 3

// Apply substitutions (i.e. "0-star" = "0")
export const ApplyEntitySubstitutions = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    Object.values(LuisSlot).map(entityName => {
        try {
            let rawValues = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
            rawValues = rawValues.filter(v =>
                (v != "the restaurant" && v != "the hotel" && v != "the taxi"))
            
            var values : (string | null)[] = []
            var matches : number[] = []
            for (var i in rawValues)
            {
                const substitution = DB.EntitySubstitutions()[rawValues[i]]
                if (substitution) {
                    values.push(substitution);
                    matches.push(0);
                }
                else if (domainFilter) {
                    const result = DB.ResolveEntityValue(rawValues[i], entityName, domainFilter)
                    values.push(result[0]);
                    matches.push(result[1]);
                }
            }

            if (values.length == 0)
            {
                return;
            }
            else if (values.length == 1 && values[0] != null)
            {
                memoryManager.Delete(entityName)
                memoryManager.Set(entityName, values[0])
            }

            // Special case hotel / guesthouse
            else if (values.includes("guesthouse") || values.includes("Guesthouse"))
            {
                memoryManager.Delete(entityName)
                memoryManager.Set(entityName, "guesthouse")
            }
            else if (values.includes("hotel") || values.includes("Hotel"))
            {
                memoryManager.Delete(entityName)
                memoryManager.Set(entityName, "hotel")
            }
            else {
                memoryManager.Delete(entityName)
                var minIndex = IndexOfMin(matches);
                if (values[minIndex] != null) {
                    memoryManager.Set(entityName, values[minIndex]!)
                }
            }
        }
        catch (e) {
            // Looping through all LUIS entities, so ok if model doesn't contain entity
            return;
        }
    })
}

export const IndexOfMin = (self: number[]): number => {
    var min: number = self[0];
    var minIndex: number = 0;

    for (var i = 1; i < self.length; ++i)
    {
        if (self[i] < min)
        {
            min = self[i];
            minIndex = i;
        }
    }

    return minIndex;
}

export const ExpandTime = (time: string, addHours: number = 0): string => {
    const parts = time.split(":")
    const hour = +parts[0] + addHours
    const min = parts[1] ? parts[1] : "00"
    return `${hour}:${min}`
}
export const ProcessTime = (time: string): string => {
    if (time.endsWith("PM") || time.endsWith("pm")) {
        const cleanTime = time.substr(0, time.length - 2)
        return ExpandTime(cleanTime, 12)
    }
    if (time.endsWith("AM") || time.endsWith("am")) {
        const cleanTime = time.substr(0, time.length - 2)
        return ExpandTime(cleanTime, 12)
    }
    return ExpandTime(time)
}

// Return version of string with no puncuation or space and lowercase (apart from : for time)
export const BaseString = (text: string): string => {
    if (!text) {
        return text;
    }
    return text.replace(/[^\w\s:]|_/g, "").replace(/\s/g, "").toLowerCase()
}

export const MemoryValue = (slot: any, memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): string | null => {

    const value = memoryManager.Get(slot, ClientMemoryManager.AS_STRING_LIST)

    if (value[0] !== "none" && value[0] !== "dontcare" && value[0] != null) {
        return BaseString(value[0])
    }
    return null
}

export const trainBetween = (trains: Train[], leaveAfter: string, arriveBefore: string): Train | null => {

    const arriveBeforeTime = parseTime(arriveBefore)
    const leaveAfterTime = parseTime(leaveAfter)

    trains.forEach(train => {
        const trainLeave = parseTime(train.leaveAt)
        const trainArrive = parseTime(train.arriveBy)
        if (trainArrive < arriveBeforeTime  && trainLeave > leaveAfterTime ) {
            return train;
        }
    })

    // Allow exact matches
    trains.forEach(train => {
        const trainLeave = parseTime(train.leaveAt)
        const trainArrive = parseTime(train.arriveBy)
        if (trainArrive <= arriveBeforeTime && trainLeave >= leaveAfterTime ) {
            return train;
        }
    })
    return null;
}

export const trainArriveBefore = (trains: Train[], arriveBefore: string): Train | null => {

    const arriveBeforeTime = parseTime(arriveBefore)
    let bestTime = Number.MAX_VALUE
    let bestTrain: Train | null = null
    trains.forEach(train => {
        const trainArrive = parseTime(train.arriveBy)
        const diff = arriveBeforeTime - trainArrive
        if (diff > 0 && diff < bestTime) {
            bestTrain = train
            bestTime = diff
        }
    })
    return bestTrain
}

export const trainLeaveAfter = (trains: Train[], leaveAfter: string): Train | null => {

    const leaveAfterTime = parseTime(leaveAfter)
    let bestTime = Number.MAX_VALUE
    let bestTrain: Train | null = null
    trains.forEach(train => {
        const trainLeave = parseTime(train.leaveAt)
        const diff = trainLeave - leaveAfterTime
        if (diff > 0 && diff < bestTime) {
            bestTrain = train
            bestTime = diff
        }
    })
    return bestTrain
}

export const parseTime = (timeString: string): number => {
    var cleanTime = timeString.replace(/[^0-9.:]/g, "");
    const parts = cleanTime.split(":")
    let time = parseInt(parts[0]) * 60;
    if (parts.length > 1) {
        time = time + parseInt(parts[1])
    }
    return time;
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
    let result = ''
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

const findEntity = (domain: string, shortName: string, entities: string[]) => {
    
    // If booking domain, look up from entities
    const domainName = (domain == "booking") ? entities[0].split('-')[0] : domain
    
    // Switch from short name to property name
    const pName = propertyName(shortName, domainName);

    // Look for semi entity
    let fullEntityName = `${domainName}-semi-${pName}`
    let foundEntity = entities.find(e => e.split(":")[0] == fullEntityName)
    if (foundEntity == null)
    {
        fullEntityName = `${domainName}-book-${pName}`
        foundEntity = entities.find(e => e.split(":")[0] == fullEntityName)
    }
    if (foundEntity == null)
    {
        fullEntityName = `booking-book-${pName}`
        foundEntity = entities.find(e => e.split(":")[0] == fullEntityName)
    }
    if (foundEntity == null)
    {
        fullEntityName = `${domainName}-inform-${pName}`
        foundEntity = entities.find(e => e.split(":")[0] == fullEntityName)
    }
    if (foundEntity == null)
    {
        fullEntityName = `${domainName}-${pName}`
        foundEntity = entities.find(e => e.split(":")[0] == fullEntityName)
    }
    if (foundEntity == null)
    {
        fullEntityName = `${pName}`;
        foundEntity = entities.find(e => e.split(":")[0] == fullEntityName)
    }
    if (foundEntity == null && domain == "booking")
    {
        foundEntity = entities.find(e => e.split(":")[0].endsWith(pName))
    }
    if (foundEntity == null && domain == "booking")
    {
        foundEntity = entities.find(e => e.split(":")[0].endsWith(shortName))
    }
    if (foundEntity == null)
    {
        console.log(`!! Can't find entity: ${domainName} ${shortName}`)
    }
    return foundEntity;
}

export const expandedResults = (dialogActs: string[], entities: string[]): string[][] => {
    const results: string[][] = []
    let bookingBook = false;
    let bookingBookNone = false;
    for (let dialogAct of dialogActs) {
        const parts = dialogAct.split('-')
        const domain = parts[0]
        const act = parts[1]
        const entity = parts[2]

        if (act == "request") {
            results.push([act, domain, entity, "?"])
        }
        else if (entity == "none") {
            results.push([act, domain, entity, "none"])
        }
        else {
            const kv = findEntity(domain, entity, entities)
            // "attraction-semi-area: east,centre,south,west,north"
            let values = kv ? kv.split(": ")[1].split(",") : ["MISSING"]

            // Fix for police as it has a comma
            if (domain == "police" && entity == "addr") {
                values = [values.join(",")];
            }
            for (const value of values) {
                results.push([act, domain, entity, value])
            }
        }

        if (domain == "booking" && act == "book") {
            bookingBook = true;
            if (entity == "none") {
                bookingBookNone = true;
            }
        }
        else if (domain == "train" && act == "offerbook") {
            bookingBook = true;
            if (entity == "none") {
                bookingBookNone = true;
            }
        }
    }

    // Force ref on all non-none booking-books if not already injected
    if (results.find(r => r[0] == "book" && r[1] == 'booking' && r[2] == "ref")) {
        bookingBook = false;
    }
    if (bookingBook && !bookingBookNone) {
        const kv = findEntity("booking", "ref", entities)
        let values = kv ? kv.split(": ")[1].split(",") : ["MISSING"]
        results.push(["booking", "book", "ref", values[0]]);
    }

    // Add choice if more than one train option
    if (!results.find(r => r[0] == "train" && r[1] == 'inform' && r[2] == "choice")) {
        var match = entities.find(e => e.indexOf("train-choice:") >= 0)
        if (match != 'train-choice: ') {
            results.push(["inform", "train", "choice", "several"]);
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

export const propertyName = (entityName: string, domainName: string): string => {
    const split = entityName.split('-')
    let shortName = split[split.length - 1]
    NameSubstitutionMap.forEach((value: string, key: string) => {
        if (value == entityName && !(shortName == "time" && domainName == "restaurant")) {
            shortName = key
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
        case Domain.POLICE:
            return Object.values(PoliceSlot)
        case Domain.HOSPITAL:
            return Object.values(HospitalSlot)
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


