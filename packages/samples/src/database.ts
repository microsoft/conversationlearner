/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as path from 'path'
import { ClientMemoryManager, ReadOnlyClientMemoryManager } from 'clwoz-sdk'
import { Restaurant, Hotel, Attraction, Taxi, Train, Hospital, Police, LuisSlot, RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, HospitalSlot, PoliceSlot, Domain, PICK_ONE, DONTCARE } from './dataTypes'
import * as fs from 'fs'
import * as Utils from './utils'
import * as Test from './test'

const DBDirectory = 'mwdb'
const SIMILARITY_THRESHOLD = 7
let _slotTypes: Map<string, string[]>

const SlotTypes = () => {
    if (_slotTypes == null) {
        ExractAllowedValues()
    }
    return _slotTypes
}

const ExractAllowedValues = () => {
    let attractionTypes = []
    let priceTypes = []
    let areaTypes = []
    let foodTypes = []
    let trainLocations = []
    for (const attraction of AttractionDb()) {
        attractionTypes.push(attraction._type)
        if (attraction.pricerange != "?") {
            priceTypes.push(attraction.pricerange)
        }
        areaTypes.push(attraction.area)
    }
    for (const train of TrainDb()) {
        trainLocations.push(train.destination)
        trainLocations.push(train.destination)
    }
    for (const restaurant of RestaurantDb()) {
        foodTypes.push(restaurant.food)
    }
    foodTypes.push("caribbean");
    foodTypes.push("australian");
    foodTypes.push("vegetarian");
    foodTypes.push("swiss");
    foodTypes.push("welsh");
    foodTypes.push("new zealand");
    foodTypes.push("polish");
    foodTypes.push("eritrean");
    foodTypes.push("danish");
    foodTypes.push("swedish");
    foodTypes.push("persian");
    foodTypes.push("greek");
    foodTypes.push("jamaican");
    foodTypes.push("belgian");
    foodTypes.push("christmas");
    foodTypes.push("malaysian");
    foodTypes.push("austrian");
    foodTypes.push("steakhouse");
    foodTypes.push("world");
    foodTypes.push("scandinavian");

    // Make unique
    attractionTypes = [...new Set(attractionTypes)]
    priceTypes = [...new Set(priceTypes)]
    areaTypes = [...new Set(areaTypes)]
    foodTypes = [...new Set(foodTypes)]
    trainLocations = [...new Set(trainLocations)]

    _slotTypes = new Map<string, string[]>()
    _slotTypes.set("attractiontype", attractionTypes)
    _slotTypes.set("pricerange", priceTypes)
    _slotTypes.set("area", areaTypes)
    _slotTypes.set("food", foodTypes)
    _slotTypes.set("trainlocations", trainLocations)
}


export let GetDirectory = (name: string) => {
    let testDirectory = path.join(process.cwd(), `./${name}`)

    // Try up a directory or two as could be in /lib or /dist folder depending on deployment
    if (!fs.existsSync(testDirectory)) {
        testDirectory = path.join(process.cwd(), `../${name}`)
    }
    if (!fs.existsSync(testDirectory)) {
        testDirectory = path.join(process.cwd(), `../../${name}`)
    }
    return testDirectory
}

export const EntitySubstitutions = (): { [key: string]: string } => {
    if (!_entitySubstitutions) {
        _entitySubstitutions = LoadDataBase("entity_substitutions")
    }
    return _entitySubstitutions
}

export const DialogActs = (): string[] => {
    if (!_dialogActs) {
        _dialogActs = LoadDataBase("dialog_acts")
    }
    return _dialogActs
}

export const ResolveEntityValue = (entityValue: string, entityName: string, domainName: string): [string | null, number] => {
    // Remove extra space added before apostrophe
    const cleanValue = entityValue.replace(" '", "'")

    if (entityName == "name") {
        if (domainName == "hotel") {
            return ResolveName(cleanValue, HotelDb(), "the", "hotel")
        }
        else if (domainName == "restaurant") {
            return ResolveName(cleanValue, RestaurantDb(), "the", "restaurant")
        }
        else if (domainName == "attraction") {
            return ResolveName(cleanValue, AttractionDb(), "the", "attraction")
        }
    }
    else if (entityName == "type") {
        if (domainName == "attraction") {
            return ResolveItem(cleanValue, SlotTypes().get("attractiontype")!)
        }
    }
    else if (entityName == "dest") {
        return ResolveItem(cleanValue, SlotTypes().get("trainlocations")!)
    }
    else if (entityName == "depart") {
        return ResolveItem(cleanValue, SlotTypes().get("trainlocations")!)
    }
    else if (entityName == "pricerange" && cleanValue != "?") {
        return ResolveItem(cleanValue, SlotTypes().get("pricerange")!)
    }
    else if (entityName == "area") {
        return ResolveItem(cleanValue, SlotTypes().get("area")!)
    }
    else if (entityName == "food") {
        return ResolveItem(cleanValue, SlotTypes().get("food")!)
    }
    return [cleanValue, 100]
}

export const ResolveItem = (name: string, values: string[]): [string | null, number] => {

    if (name == "dontcare") {
        return [null, 0]
    }

    // Try exact match
    let match = values.find(h => h == name)
    if (match != null) {
        return [match, 0]
    }

        
    // Try containment
    match = values.find(h => h.indexOf(name) >= 0)
    if (match != null) {
        return [match, 50]
    }

    // Try phrase similarity
    let best = null
    let bestDist = 100
    for (const value of values) {
        for (const word in name.split(" ")) {
            if (word.indexOf(value) >= 0 || value.indexOf(word) >= 0) {
                best = value
                break
            }
        }
        const dist = Utils.levenshtein(name, value)
        if (dist < bestDist) {
            best = value
            bestDist = dist
        }
    }
    if (best != null) {
        return [best, bestDist]
    }
    else {
        return [name, 100]
    }
}

const ResolveName = (name: string, items: any[], preString: string, postString: string) : [string | null, number] => {
    let before = `${preString} `
    let after = ` ${postString}`

    if (name == "dontcare") {
        return [null, 0]
    }
    
    // First check raw name
    if (items.find(h => h.name == name)) {
        return [name, 0]
    }

    // i.e. " hotel"
    if (name.indexOf(after) >= 0) {
        const shortName = name.replace(after, "")
        if (items.find(h => h.name == shortName)) {
            return [shortName, 0]
        }
    }
    else {
        // Otherwise try adding " hotel"
        const longName = `{name}{after}`
        if (HotelDb().find(h => h.name == longName)) {
            return [longName, 0]
        }
    }

    // i.e. "the "
    if (name.indexOf(before) >= 0) {
        const shortName = name.replace(before, "")
        if (items.find(h => h.name == shortName)) {
            return [shortName, 0]
        }
    }
    else {
        // Otherwise try adding "the "
        const longName = `{before}{name}`
        if (items.find(h => h.name == longName)) {
            return [longName, 0]
        }
    }

    // Try without either
    if (name.indexOf(before) >= 0 && name.indexOf(after) >= 0) {
        let shortName = name.replace(before, "")
        shortName = shortName.replace(after, "")
        if (items.find(h => h.name == shortName)) {
            return [shortName, 0]
        }
    }

    // Try containment
    const match = items.find(h => h.name.indexOf(name) >= 0)
    if (match != null) {
        return [match.name, 50]
    }

    // Try phrase similarity
    let best: string | undefined = undefined
    let bestDist: number = SIMILARITY_THRESHOLD
    for (const a of items) {
        const dist = Utils.levenshtein(name, a.name)
        if (dist < bestDist) {
            best = a.name
            bestDist = dist
        }
    }
    if (best) {
        return [best, bestDist]
    }
    else {
        return [name, 0]
    }
}

export const UpdateEntities = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {

    // Clear old memories in case user changes their mind
    Object.values(LuisSlot).forEach(entityName => {
        var curMemory = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        var prevMemory = memoryManager.GetPrevious(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (curMemory.length > 1 && prevMemory.length > 0) {
            var newMemory = curMemory.filter(v => prevMemory.indexOf(v) == -1);
            memoryManager.Delete(entityName);
            memoryManager.Set(entityName, newMemory);
        }
    })
    UpdateDomain(memoryManager, domainFilter)
    UpdateDB(memoryManager, domainFilter)
}

export const ClearAsks = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {

    if (domainFilter == "restaurant") {
        memoryManager.Delete("global-ask-food")
        memoryManager.Delete("global-ask-price")
        memoryManager.Delete("global-ask-area")
        memoryManager.Delete("global-ask-day")
        memoryManager.Delete("global-ask-addr")
        memoryManager.Delete("global-ask-name")
    }
    if (domainFilter == "hotel") {
        memoryManager.Delete("global-ask-price")
        memoryManager.Delete("global-ask-stars")
        memoryManager.Delete("global-ask-type")
        memoryManager.Delete("global-ask-area")
        memoryManager.Delete("global-ask-name")
        memoryManager.Delete("global-ask-day")
    }
    if (domainFilter == "attraction") {
        memoryManager.Delete("global-ask-type")
        memoryManager.Delete("global-ask-name")
        memoryManager.Delete("global-ask-area")
        memoryManager.Delete("global-ask-price")
    }
    if (domainFilter == "taxi") {
        memoryManager.Delete("global-ask-leave")
        memoryManager.Delete("global-ask-arrive")
    }
    if (domainFilter == "train") {
        memoryManager.Delete("global-ask-leave")
        memoryManager.Delete("global-ask-arrive")
        memoryManager.Delete("global-ask-people")
    }
    // TODO HP?
}

// Move items from general to domain specific and then clear general
const UpdateDomain = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {

    Utils.ApplyEntitySubstitutions(memoryManager, domainFilter)

    const day = memoryManager.Get(LuisSlot.DAY, ClientMemoryManager.AS_STRING)
    const people = memoryManager.Get(LuisSlot.PEOPLE, ClientMemoryManager.AS_STRING)
    let time = memoryManager.Get(LuisSlot.TIME, ClientMemoryManager.AS_STRING)
    const area = memoryManager.Get(LuisSlot.AREA, ClientMemoryManager.AS_STRING)
    const food = memoryManager.Get(LuisSlot.FOOD, ClientMemoryManager.AS_STRING)
    const price = memoryManager.Get(LuisSlot.PRICE, ClientMemoryManager.AS_STRING)
    const arrive = memoryManager.Get(LuisSlot.ARRIVE_BY, ClientMemoryManager.AS_STRING)
    const depart = memoryManager.Get(LuisSlot.DEPART, ClientMemoryManager.AS_STRING)
    const dest = memoryManager.Get(LuisSlot.DESTINATION, ClientMemoryManager.AS_STRING)
    const leave = memoryManager.Get(LuisSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)
    const stay = memoryManager.Get(LuisSlot.STAY, ClientMemoryManager.AS_STRING)
    const internetYes = memoryManager.Get(LuisSlot.INTERNET_YES, ClientMemoryManager.AS_STRING)
    const internetNo = memoryManager.Get(LuisSlot.INTERNET_NO, ClientMemoryManager.AS_STRING)
    const name = memoryManager.Get(LuisSlot.NAME, ClientMemoryManager.AS_STRING)
    const parkingYes = memoryManager.Get(LuisSlot.PARKING_YES, ClientMemoryManager.AS_STRING)
    const parkingNo = memoryManager.Get(LuisSlot.PARKING_NO, ClientMemoryManager.AS_STRING)
    const stars = memoryManager.Get(LuisSlot.STARS, ClientMemoryManager.AS_STRING)
    const type_ = memoryManager.Get(LuisSlot.TYPE, ClientMemoryManager.AS_STRING)
    const department = memoryManager.Get(LuisSlot.DEPARTMENT, ClientMemoryManager.AS_STRING)

    // Handle bad match where both are set
    if (leave && leave == arrive) {
        memoryManager.Delete(LuisSlot.ARRIVE_BY);
    }

    if (time) {
        time = Utils.ProcessTime(time)
    }

    if (!domainFilter) {
        if (memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)) {
            domainFilter = "restaurant"
        }
        else if (memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)) {
            domainFilter = "train"
        }
        else if (memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)) {
            domainFilter = "taxi"
        }
        else if (memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)) {
            domainFilter = "hotel"
        }
        else if (memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)) {
            domainFilter = "attraction"
        }
        else if (memoryManager.Get(Domain.HOSPITAL, ClientMemoryManager.AS_STRING)) {
            domainFilter = "hospital"
        }
        else if (memoryManager.Get(Domain.POLICE, ClientMemoryManager.AS_STRING)) {
            domainFilter = "police"
        }
        else {
            return
        }
    }
    if (domainFilter === "restaurant") {
        if (day && day != DONTCARE) {
            memoryManager.Delete(RestaurantSlot.DAY)
            memoryManager.Set(RestaurantSlot.DAY, day)
        }
        if (people && people != DONTCARE) {
            memoryManager.Delete(RestaurantSlot.PEOPLE)
            memoryManager.Set(RestaurantSlot.PEOPLE, people)
        }
        if (time && time != DONTCARE) {
            memoryManager.Delete(RestaurantSlot.TIME)
            memoryManager.Set(RestaurantSlot.TIME, time)
        }
        if (area && area != DONTCARE) {
            memoryManager.Delete(RestaurantSlot.AREA)
            memoryManager.Set(RestaurantSlot.AREA, area)
        }
        if (food && food != DONTCARE) {
            memoryManager.Delete(RestaurantSlot.FOOD)
            memoryManager.Set(RestaurantSlot.FOOD, food)
        }
        if (name && name != DONTCARE) {
            memoryManager.Delete(RestaurantSlot.NAME)
            memoryManager.Set(RestaurantSlot.NAME, name)
        }
        if (price && price != DONTCARE) {
            memoryManager.Delete(RestaurantSlot.PRICERANGE)
            memoryManager.Set(RestaurantSlot.PRICERANGE, price)
        }
        return
    }
    if (domainFilter === "train") {
        if (people && people != DONTCARE) {
            memoryManager.Delete(TrainSlot.PEOPLE)
            memoryManager.Set(TrainSlot.PEOPLE, people)
        }
        if (day && day != DONTCARE) {
            memoryManager.Delete(TrainSlot.DAY)
            memoryManager.Set(TrainSlot.DAY, day)
        }
        if (depart && depart != DONTCARE) {
            memoryManager.Delete(TrainSlot.DEPART)
            memoryManager.Set(TrainSlot.DEPART, depart)
        }
        if (dest && dest != DONTCARE) {
            memoryManager.Delete(TrainSlot.DESTINATION)
            memoryManager.Set(TrainSlot.DESTINATION, dest)
        }
        return
    }
    if (domainFilter === "hotel") {
        if (day && day != DONTCARE) {
            memoryManager.Delete(HotelSlot.DAY)
            memoryManager.Set(HotelSlot.DAY, day)
        }
        if (people && people != DONTCARE) {
            memoryManager.Delete(HotelSlot.PEOPLE)
            memoryManager.Set(HotelSlot.PEOPLE, people)
        }
        if (stay && stay != DONTCARE) {
            memoryManager.Delete(HotelSlot.STAY)
            memoryManager.Set(HotelSlot.STAY, stay)
        }
        if (area && area != DONTCARE) {
            memoryManager.Delete(HotelSlot.AREA)
            memoryManager.Set(HotelSlot.AREA, area)
        }
        if (internetYes && internetYes != DONTCARE) {
            memoryManager.Delete(HotelSlot.INTERNET)
            memoryManager.Set(HotelSlot.INTERNET, "yes")
        }
        if (internetNo && internetNo != DONTCARE) {
            memoryManager.Delete(HotelSlot.INTERNET)
            memoryManager.Set(HotelSlot.INTERNET, "no")
        }
        if (name && name != DONTCARE) {
            memoryManager.Delete(HotelSlot.NAME)
            memoryManager.Set(HotelSlot.NAME, name)
        }
        if (parkingYes && parkingYes != DONTCARE) {
            memoryManager.Delete(HotelSlot.PARKING)
            memoryManager.Set(HotelSlot.PARKING, "yes")
        }
        if (parkingNo && parkingNo != DONTCARE) {
            memoryManager.Delete(HotelSlot.PARKING)
            memoryManager.Set(HotelSlot.PARKING, "no")
        }
        if (price && price != DONTCARE) {
            memoryManager.Delete(HotelSlot.PRICERANGE)
            memoryManager.Set(HotelSlot.PRICERANGE, price)
        }
        if (stars && stars != DONTCARE) {
            memoryManager.Delete(HotelSlot.STARS)
            memoryManager.Set(HotelSlot.STARS, stars)
        }
        if (type_ && type_ != DONTCARE) {
            var hoteltype = Utils.MemoryValue(LuisSlot.TYPE, memoryManager)
            if (hoteltype) {
                memoryManager.Delete(HotelSlot.TYPE)
                memoryManager.Set(HotelSlot.TYPE, hoteltype)
            }
        }
    }
    if (domainFilter === "taxi") {
        if (arrive && arrive != DONTCARE) {
            memoryManager.Delete(TaxiSlot.ARRIVE_BY)
            memoryManager.Set(TaxiSlot.ARRIVE_BY, arrive)
        }
        if (depart && depart != DONTCARE) {
            memoryManager.Delete(TaxiSlot.DEPART)
            memoryManager.Set(TaxiSlot.DEPART, depart)
        }
        if (dest && dest != DONTCARE) {
            memoryManager.Delete(TaxiSlot.DESTINATION)
            memoryManager.Set(TaxiSlot.DESTINATION, dest)
        }
        if (leave && leave != DONTCARE) {
            memoryManager.Delete(TaxiSlot.LEAVE_AT)
            memoryManager.Set(TaxiSlot.LEAVE_AT, leave)
        }
        return
    }
    if (domainFilter === "attraction") {
        if (area && area != DONTCARE) {
            memoryManager.Delete(AttractionSlot.AREA)
            memoryManager.Set(AttractionSlot.AREA, area)
        }
        if (name && name != DONTCARE) {
            memoryManager.Delete(AttractionSlot.NAME)
            memoryManager.Set(AttractionSlot.NAME, name)
        }
        if (type_ && type_ != DONTCARE) {
            memoryManager.Delete(AttractionSlot.TYPE)
            memoryManager.Set(AttractionSlot.TYPE, type_)
        }
        return
    }
    if (domainFilter === "hospital") {
        if (department) {
            memoryManager.Delete(HospitalSlot.DEPARTMENT)
            memoryManager.Set(HospitalSlot.DEPARTMENT, department)
        }
        return
    }
    if (domainFilter === "police") {
        if (name) {
            memoryManager.Delete(PoliceSlot.NAME)
            memoryManager.Set(PoliceSlot.NAME, name)
        }
        return
    }
}

const SetEntities = (items: string[], luisSlotName: any, slotName: any, countSlotName: any, memoryManager: ClientMemoryManager) => {

    // If LUIS hasn't already filled this entity, don't use database value
    var luisValue = luisSlotName ? memoryManager.Get(luisSlotName, ClientMemoryManager.AS_STRING) : undefined;
    if (!luisValue || luisValue == DONTCARE) {
            memoryManager.Delete(slotName)
            // Remove 
            const values = items.filter(i => i !== "?" && i !== "" && i != undefined)//LARS TEMP.map(s => s ? s : "")
            if (values.length == 1) {
                memoryManager.Set(slotName, values)
                memoryManager.Delete(countSlotName)
            }
            else if (values.length > 1) {
                memoryManager.Set(slotName, values.slice(0, Utils.MAX_MULTI_VALUE))
                memoryManager.Set(countSlotName, values.length)
            }
            else 
            {
                memoryManager.Delete(countSlotName)
            }
    }
    else {
        memoryManager.Delete(countSlotName)
    }
}

export const UpdateDB = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {

    if (domainFilter == "restaurant") {

        let failInfo: { [id: string]: string } = {}
        if (Test.TestGoal) {
            failInfo = { ...Test.TestGoal.restaurant.fail_book, ...Test.TestGoal.restaurant.fail_info }
        }

        let [restaurants, failed] = RestaurantOptions(memoryManager, failInfo)
        // If new conditions don't meet bot choice, clear bot choice as conditions might have changed
        if (!failed && restaurants.length == 0 && memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)) {
            memoryManager.Delete(RestaurantSlot.NAME)
            restaurants = RestaurantOptions(memoryManager, failInfo)[0]
        }
        // If new conditions still aren't met bot choice, clear bot choice
        if (!failed && restaurants.length == 0 && memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)) {
            memoryManager.Delete(PICK_ONE)
            restaurants = RestaurantOptions(memoryManager, failInfo)[0]
        }

        const addresss = [... new Set(restaurants.map(a => a.address))]
        SetEntities(addresss, null, RestaurantSlot.ADDRESS, RestaurantSlot.ADDRESS_COUNT, memoryManager)

        const areas = [... new Set(restaurants.map(a => a.area))]
        SetEntities(areas, LuisSlot.AREA, RestaurantSlot.AREA, RestaurantSlot.AREA_COUNT, memoryManager)

        const foods = [... new Set(restaurants.map(a => a.food))]
        SetEntities(foods, LuisSlot.FOOD, RestaurantSlot.FOOD, RestaurantSlot.FOOD_COUNT, memoryManager)

        const names = [... new Set(restaurants.map(a => a.name))]
        SetEntities(names, LuisSlot.NAME, RestaurantSlot.NAME, RestaurantSlot.NAME_COUNT, memoryManager)

        const phones = [... new Set(restaurants.map(a => a.phone))]
        SetEntities(phones, null, RestaurantSlot.PHONE, RestaurantSlot.PHONE_COUNT, memoryManager)

        const postcodes = [... new Set(restaurants.map(a => a.postcode))]
        SetEntities(postcodes, null, RestaurantSlot.POSTCODE, RestaurantSlot.POSTCODE_COUNT, memoryManager)

        const priceranges = [... new Set(restaurants.map(a => a.pricerange))]
        SetEntities(priceranges, LuisSlot.PRICE, RestaurantSlot.PRICERANGE, RestaurantSlot.PRICERANGE_COUNT, memoryManager)

        memoryManager.Delete(RestaurantSlot.CHOICE_NONE)
        memoryManager.Delete(RestaurantSlot.CHOICE_ONE)
        memoryManager.Delete(RestaurantSlot.CHOICE_MANY)
        memoryManager.Delete(RestaurantSlot.BOOK_READY)
     //LARS TODO   memoryManager.Delete("global-ask-food");

        if (restaurants.length == 0) {
            memoryManager.Set(RestaurantSlot.CHOICE_NONE, true)
        }
        else if (restaurants.length == 1) {
            memoryManager.Set(RestaurantSlot.CHOICE_ONE, true)
            if (memoryManager.Get(RestaurantSlot.PEOPLE, ClientMemoryManager.AS_VALUE_LIST).length == 1
                && memoryManager.Get(RestaurantSlot.DAY, ClientMemoryManager.AS_VALUE_LIST).length == 1
                && memoryManager.Get(RestaurantSlot.TIME, ClientMemoryManager.AS_VALUE_LIST).length == 1) {
            memoryManager.Set(RestaurantSlot.BOOK_READY, true)
        }
        }
        else {
            memoryManager.Set(RestaurantSlot.CHOICE_MANY, restaurants.length)
        }
    }
    if (domainFilter == "hotel") {

        let failInfo: { [id: string]: string } = {}
        if (Test.TestGoal) {
            failInfo = { ...Test.TestGoal.hotel.fail_book, ...Test.TestGoal.hotel.fail_info }
        }

        let [hotels, failed] = HotelOptions(memoryManager, failInfo)
        // If new conditions don't meet bot choice, clear bot choice as conditions might have changed
        if (!failed && hotels.length == 0 && memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)) {
            memoryManager.Delete(HotelSlot.NAME)
            hotels = HotelOptions(memoryManager, failInfo)[0]
        }
        // If new conditions still don't meet bot choice, clear bot choice
        if (!failed && hotels.length == 0 && memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)) {
            memoryManager.Delete(PICK_ONE)
            hotels = HotelOptions(memoryManager, failInfo)[0]
        }
        const addresss = [... new Set(hotels.map(a => a.address))]
        SetEntities(addresss, null, HotelSlot.ADDRESS, HotelSlot.ADDRESS_COUNT, memoryManager)

        const areas = [... new Set(hotels.map(a => a.area))]
        SetEntities(areas, LuisSlot.AREA, HotelSlot.AREA, HotelSlot.AREA_COUNT, memoryManager)

        // LARS TODO. better handle internet
        const internets = [... new Set(hotels.map(a => a.internet))]
        SetEntities(internets, LuisSlot.INTERNET_YES, HotelSlot.INTERNET, HotelSlot.INTERNET_COUNT, memoryManager)

        // LARS TODO. better handle parking
        const parkings = [... new Set(hotels.map(a => a.parking))]
        SetEntities(parkings, LuisSlot.PARKING_YES, HotelSlot.PARKING, HotelSlot.PARKING_COUNT, memoryManager)

        const names = [... new Set(hotels.map(a => a.name))]
        SetEntities(names, LuisSlot.NAME, HotelSlot.NAME, HotelSlot.NAME_COUNT, memoryManager)

        const phones = [... new Set(hotels.map(a => a.phone))]
        SetEntities(phones, null, HotelSlot.PHONE, HotelSlot.PHONE_COUNT, memoryManager)

        const postcodes = [... new Set(hotels.map(a => a.postcode))]
        SetEntities(postcodes, null, HotelSlot.POSTCODE, HotelSlot.POSTCODE_COUNT, memoryManager)

        const priceranges = [... new Set(hotels.map(a => a.pricerange))]
        SetEntities(priceranges, LuisSlot.PRICE, HotelSlot.PRICERANGE, HotelSlot.PRICERANGE_COUNT, memoryManager)

        const starss = [... new Set(hotels.map(a => a.stars))]
        SetEntities(starss, LuisSlot.STARS, HotelSlot.STARS, HotelSlot.STARS_COUNT, memoryManager)

        const types = [... new Set(hotels.map(a => a._type))]
        SetEntities(types, LuisSlot.TYPE, HotelSlot.TYPE, HotelSlot.TYPE_COUNT, memoryManager)

        memoryManager.Delete(HotelSlot.CHOICE_NONE)
        memoryManager.Delete(HotelSlot.CHOICE_ONE)
        memoryManager.Delete(HotelSlot.CHOICE_MANY)
        memoryManager.Delete(HotelSlot.BOOK_READY)


        if (hotels.length == 0) {
            memoryManager.Set(HotelSlot.CHOICE_NONE, true)
        }
        else if (hotels.length == 1) {
            memoryManager.Set(HotelSlot.CHOICE_ONE, true)
            if (memoryManager.Get(HotelSlot.PEOPLE, ClientMemoryManager.AS_VALUE_LIST).length == 1
                && memoryManager.Get(HotelSlot.DAY, ClientMemoryManager.AS_VALUE_LIST).length == 1
                && memoryManager.Get(HotelSlot.STAY, ClientMemoryManager.AS_VALUE_LIST).length == 1) {
                memoryManager.Set(HotelSlot.BOOK_READY, true)
            }
        }
        else {
            memoryManager.Set(HotelSlot.CHOICE_MANY, hotels.length)
        }
    }
    if (domainFilter == "attraction") {

        let failInfo: { [id: string]: string } = {}
        if (Test.TestGoal) {
            failInfo = { ...Test.TestGoal.attraction.fail_book, ...Test.TestGoal.attraction.fail_info }
        }

        var [attractions, failed] = AttractionOptions(memoryManager, failInfo)
        // If new conditions don't meet bot choice, clear bot choice as conditions might have changed
        if (!failed && attractions.length == 0 && memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)) {
            memoryManager.Delete(AttractionSlot.NAME)
            attractions = AttractionOptions(memoryManager, failInfo)[0]
        }
        // If new conditions still aren't met bot choice, clear bot choice
        if (!failed && attractions.length == 0 && memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)) {
            memoryManager.Delete(PICK_ONE)
            attractions = AttractionOptions(memoryManager, failInfo)[0]
        }

        memoryManager.Delete(AttractionSlot.AREA_COUNT)

        const addresss = [... new Set(attractions.map(a => a.address))]
        SetEntities(addresss, null, AttractionSlot.ADDRESS, AttractionSlot.ADDRESS_COUNT, memoryManager)

        const areas = [... new Set(attractions.map(a => a.area))]
        SetEntities(areas, LuisSlot.AREA, AttractionSlot.AREA, AttractionSlot.AREA_COUNT, memoryManager)

        const entrancefees = [... new Set(attractions.map(a => a.entrancefee))]
        SetEntities(entrancefees, null, AttractionSlot.FEE, AttractionSlot.FEE_COUNT, memoryManager)

        const names = [... new Set(attractions.map(a => a.name))]
        SetEntities(names, LuisSlot.NAME, AttractionSlot.NAME, AttractionSlot.NAME_COUNT, memoryManager)

        const openhourss = [... new Set(attractions.map(a => a.openhours))]
        SetEntities(openhourss, null, AttractionSlot.OPEN, AttractionSlot.OPEN_COUNT, memoryManager)

        const phones = [... new Set(attractions.map(a => a.phone))]
        SetEntities(phones, null, AttractionSlot.PHONE, AttractionSlot.PHONE_COUNT, memoryManager)

        const postcodes = [... new Set(attractions.map(a => a.postcode))]
        SetEntities(postcodes, null, AttractionSlot.POSTCODE, AttractionSlot.POSTCODE_COUNT, memoryManager)

        const priceranges = [... new Set(attractions.map(a => a.pricerange))]
        SetEntities(priceranges, LuisSlot.PRICE, AttractionSlot.PRICERANGE, AttractionSlot.PRICERANGE_COUNT, memoryManager)

        const types = [... new Set(attractions.map(a => a._type))]
        SetEntities(types, LuisSlot.TYPE, AttractionSlot.TYPE, AttractionSlot.TYPE_COUNT, memoryManager)

        memoryManager.Delete(AttractionSlot.CHOICE_NONE)
        memoryManager.Delete(AttractionSlot.CHOICE_ONE)
        memoryManager.Delete(AttractionSlot.CHOICE_MANY)

        if (attractions.length == 0) {
            memoryManager.Set(AttractionSlot.CHOICE_NONE, true)
        }
        else if (attractions.length == 1) {
            memoryManager.Set(AttractionSlot.CHOICE_ONE, true)
        }
        else {
            memoryManager.Set(AttractionSlot.CHOICE_MANY, attractions.length)
        }
    }
    if (domainFilter == "taxi") {

        let failInfo: { [id: string]: string } = {}
        if (Test.TestGoal) {
            failInfo = { ...Test.TestGoal.taxi.fail_book, ...Test.TestGoal.taxi.fail_info }
        }

        const taxis = TaxiOptions(memoryManager, failInfo)
        taxis.length
        // There's always a taxi
        memoryManager.Set(TaxiSlot.CHOICE_ONE, true)

        const colors = taxis[0].taxi_colors
        const types = taxis[0].taxi_types
        //const phones = taxis[0].taxi_phone

        const color = colors[Math.floor(Math.random() * colors.length)]
        const _type = types[Math.floor(Math.random() * types.length)]
        //const phone = phones[Math.floor(Math.random() * phone.length)];

        memoryManager.Delete(TaxiSlot.CAR)
        memoryManager.Delete(TaxiSlot.PHONE)
        memoryManager.Set(TaxiSlot.CAR, `${color} ${_type}`)
        memoryManager.Set(TaxiSlot.PHONE, "07936397340")
    }

    if (domainFilter == "train") {

        let failInfo: { [id: string]: string } = {}
        if (Test.TestGoal) {
            failInfo = { ...Test.TestGoal.train.fail_book, ...Test.TestGoal.train.fail_info }
        }

        let [trains, failed] = TrainOptions(memoryManager, failInfo)
        // If new conditions don't meet bot choice, clear bot choice as conditions might have changed
        if (!failed && trains.length == 0 && memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)) {
            memoryManager.Delete(TrainSlot.ID)
            trains = TrainOptions(memoryManager, failInfo)[0]
        }
        // If new conditions still aren't met bot choice, clear bot choice
        if (!failed && trains.length == 0 && memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)) {
            memoryManager.Delete(PICK_ONE)
            trains = TrainOptions(memoryManager, failInfo)[0]
        }

        const days = [... new Set(trains.map(a => a.day))]
        SetEntities(days, null, TrainSlot.DAY, TrainSlot.DAY_COUNT, memoryManager)

        const departures = [... new Set(trains.map(a => a.departure))]
        SetEntities(departures, LuisSlot.DEPART, TrainSlot.DEPART, TrainSlot.DEPART_COUNT, memoryManager)

        const destinations = [... new Set(trains.map(a => a.destination))]
        SetEntities(destinations, LuisSlot.DESTINATION, TrainSlot.DESTINATION, TrainSlot.DESTINATION_COUNT, memoryManager)

        var bookready = 
            memoryManager.Get(TrainSlot.DEPART, ClientMemoryManager.AS_STRING_LIST).length == 1 
            && memoryManager.Get(TrainSlot.DESTINATION, ClientMemoryManager.AS_STRING_LIST).length == 1 
            && memoryManager.Get(TrainSlot.DAY, ClientMemoryManager.AS_STRING_LIST).length == 1

        // Only set times & trainId after destination / departure / day have been chosen
        if (bookready)  {
            const arriveBys = [... new Set(trains.map(a => a.arriveBy))]
            // Null LUIS slot as times are diff
            SetEntities(arriveBys, null, TrainSlot.ARRIVE_BY, TrainSlot.ARRIVE_BY_COUNT, memoryManager)

            const leaveAts = [... new Set(trains.map(a => a.leaveAt))]
            // Null LUIS slot as times are diff
            SetEntities(leaveAts, null, TrainSlot.LEAVE_AT, TrainSlot.LEAVE_AT_COUNT, memoryManager)

            const trainIDs = [... new Set(trains.map(a => a.trainID))]
            SetEntities(trainIDs, null, TrainSlot.ID, TrainSlot.ID_COUNT, memoryManager)
        }
        else {
            memoryManager.Delete(TrainSlot.ARRIVE_BY)
            memoryManager.Delete(TrainSlot.ARRIVE_BY_COUNT)
            memoryManager.Delete(TrainSlot.LEAVE_AT)
            memoryManager.Delete(TrainSlot.LEAVE_AT_COUNT)
            memoryManager.Delete(TrainSlot.ID)
            memoryManager.Delete(TrainSlot.ID_COUNT)
        }
        
        // Only set prices if bookready or all prices are the same
        const prices = [... new Set(trains.map(a => a.price))]
        if (bookready || prices.length == 1) {
        SetEntities(prices, null, TrainSlot.TICKET, TrainSlot.TICKET_COUNT, memoryManager)
        }
        else {
            memoryManager.Delete(TrainSlot.TICKET)
            memoryManager.Delete(TrainSlot.TICKET_COUNT)
        }

        // Only set duration if bookready or all prices are the same
        const durations = [... new Set(trains.map(a => a.duration))]
        if (bookready || durations.length == 1) {
            SetEntities(durations, null, TrainSlot.DURATION, TrainSlot.DURATION_COUNT, memoryManager)
        }
        else {
            memoryManager.Delete(TrainSlot.DURATION)
            memoryManager.Delete(TrainSlot.DURATION_COUNT)
        }

        memoryManager.Delete(TrainSlot.CHOICE_NONE)
        memoryManager.Delete(TrainSlot.CHOICE_ONE)
        memoryManager.Delete(TrainSlot.CHOICE_MANY)
        memoryManager.Delete(TrainSlot.BOOK_READY)

        if (trains.length == 0) {
            memoryManager.Set(TrainSlot.CHOICE_NONE, true)
        }
        else if (trains.length == 1) {
            memoryManager.Set(TrainSlot.CHOICE_ONE, true)
            if (memoryManager.Get(TrainSlot.PEOPLE, ClientMemoryManager.AS_VALUE_LIST).length == 1
                && memoryManager.Get(TrainSlot.DAY, ClientMemoryManager.AS_VALUE_LIST).length == 1
                && memoryManager.Get(TrainSlot.DESTINATION, ClientMemoryManager.AS_VALUE_LIST).length == 1
                && memoryManager.Get(TrainSlot.DEPART, ClientMemoryManager.AS_VALUE_LIST).length == 1) {
                memoryManager.Set(TrainSlot.BOOK_READY, true)
            }
        }
        else {
            memoryManager.Set(TrainSlot.CHOICE_MANY, trains.length)
        }
    }
    if (domainFilter == "police") {

        const police = PoliceOptions(memoryManager)
        
        // There's always a police
        memoryManager.Set(PoliceSlot.CHOICE_ONE, true)

        memoryManager.Delete(PoliceSlot.NAME)
        memoryManager.Delete(PoliceSlot.ADDRESS)
        memoryManager.Delete(PoliceSlot.PHONE)
        memoryManager.Delete(PoliceSlot.POSTCODE)
        memoryManager.Delete(PoliceSlot.ID)
        memoryManager.Set(PoliceSlot.NAME, police[0].name)
        memoryManager.Set(PoliceSlot.ADDRESS, police[0].address)
        memoryManager.Set(PoliceSlot.PHONE, police[0].phone)
        memoryManager.Set(PoliceSlot.POSTCODE, police[0].postcode)
        memoryManager.Set(PoliceSlot.ID, police[0].id)
    }
    if (domainFilter == "hospital") {
        var hospitals = HospitalOptions(memoryManager)

        const addresss = [... new Set(hospitals.map(a => a.address))]
        SetEntities(addresss, null, HospitalSlot.ADDRESS, HospitalSlot.ADDRESS_COUNT, memoryManager)

        const departments = [... new Set(hospitals.map(a => a.department))]
        SetEntities(departments, LuisSlot.NAME, HospitalSlot.DEPARTMENT, HospitalSlot.DEPARTMENT_COUNT, memoryManager)

        const postcodes = [... new Set(hospitals.map(a => a.postcode))]
        SetEntities(postcodes, null, HospitalSlot.POSTCODE, HospitalSlot.POSTCODE_COUNT, memoryManager)

        const phones = [... new Set(hospitals.map(a => a.phone))]
        SetEntities(phones, null, HospitalSlot.PHONE, HospitalSlot.PHONE_COUNT, memoryManager)

        const ids = [... new Set(hospitals.map(a => a.id))]
        SetEntities(ids, null, HospitalSlot.ID, HospitalSlot.ID_COUNT, memoryManager)

        memoryManager.Delete(HospitalSlot.CHOICE_NONE)
        memoryManager.Delete(HospitalSlot.CHOICE_ONE)
        memoryManager.Delete(HospitalSlot.CHOICE_MANY)

        if (hospitals.length == 0) {
            memoryManager.Set(HospitalSlot.CHOICE_NONE, true)
        }
        else if (hospitals.length == 1) {
            memoryManager.Set(HospitalSlot.CHOICE_ONE, true)
        }
        else {
            memoryManager.Set(HospitalSlot.CHOICE_MANY, hospitals.length)
        }
    }
}

//=================================
// Domain Get Entities
//=================================
export const getEntities = (domain: Domain, memoryManager: ClientMemoryManager) => {
    switch (domain) {
        case Domain.ATTRACTION:
            return attractionEntities(memoryManager)
        case Domain.HOTEL:
            return hotelEntities(memoryManager)
        case Domain.RESTAURANT:
            return restaurantEntities(memoryManager)
        case Domain.TRAIN:
            return trainEntities(memoryManager)
        case Domain.TAXI:
            return taxiEntities(memoryManager)
        case Domain.HOSPITAL:
            return hospitalEntities(memoryManager)
        case Domain.POLICE:
            return policeEntities(memoryManager)
    }
}

const trainEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    // Set reference
    const names = memoryManager.Get("train-id", ClientMemoryManager.AS_STRING_LIST);

    if (names.length == 1) {
        const destination = memoryManager.Get("train-semi-destination", ClientMemoryManager.AS_STRING);
        const departure = memoryManager.Get("train-semi-departure", ClientMemoryManager.AS_STRING);
        var train = TrainDb().find(r => 
            r.trainID == names[0]
            && r.destination == destination
            && r.departure == departure
            )
        if (train) {
            entities.push(`booking-book-ref: ${train.ref}`)
        }
    }

    Object.values(TrainSlot).map((entityName: string) => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
    })
    return entities
}

const restaurantEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    // Set reference
    const names = memoryManager.Get("restaurant-semi-name", ClientMemoryManager.AS_STRING_LIST);
    if (names.length == 1) {
        var restaurant = RestaurantDb().find(r => r.name == names[0])
        if (restaurant) {
            entities.push(`booking-book-ref: ${restaurant.ref}`)
        }
    }

    Object.values(RestaurantSlot).map(entityName => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
    })
    return entities
}

const hotelEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    // Set reference
    const names = memoryManager.Get("hotel-semi-name", ClientMemoryManager.AS_STRING_LIST);
    if (names.length == 1) {
        var hotel = HotelDb().find(r => r.name == names[0])
        if (hotel) {
            entities.push(`booking-book-ref: ${hotel.ref}`)
        }
    }

    Object.values(HotelSlot).map(entityName => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
    })

    return entities
}

const attractionEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    // Set reference
    const names = memoryManager.Get("attraction-semi-name", ClientMemoryManager.AS_STRING_LIST);
    if (names.length == 1) {
        var attraction = AttractionDb().find(r => r.name == names[0])
        if (attraction) {
            entities.push(`booking-book-ref: ${attraction.ref}`)
        }
    }

    Object.values(AttractionSlot).map(entityName => {
        const values = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (values) {
            entities.push(`${entityName}: ${values}`)
        }
    })
    return entities
}

const taxiEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(TaxiSlot).map(entityName => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
    })
    return entities
}

const policeEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(PoliceSlot).map(entityName => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
    })
    return entities
}

const hospitalEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(HospitalSlot).map(entityName => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
    })
    return entities
}

export interface DomainResult {
    dialogActs: string[]
    entities: string[]
    output: string[][]
}

export interface ActivityResult {
    // Used to match import utterances
    activityId: string
    modelResults: Map<string, DomainResult | null>
    creationTime?: number
}

const RestaurantOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo: { [id: string]: string }): [Restaurant[], boolean] =>  {

    const pickone = memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)
    const pickedname = memoryManager.Get(RestaurantSlot.NAME, ClientMemoryManager.AS_STRING_LIST)

    const area = Utils.MemoryValue(LuisSlot.AREA, memoryManager)
    const food = Utils.MemoryValue(LuisSlot.FOOD, memoryManager)
    const name = Utils.MemoryValue(LuisSlot.NAME, memoryManager)
    const pricerange =  Utils.MemoryValue(LuisSlot.PRICE, memoryManager)

    // Non-filtered value
    const time = Utils.MemoryValue(LuisSlot.TIME, memoryManager)

    let restaurants = RestaurantDb()
    if (pickone && pickedname?.length == 1) {
        var pickbase = Utils.BaseString(pickedname[0])
        restaurants = restaurants.filter(r => pickbase === Utils.BaseString(r.name))
    }
    if (area) {
        restaurants = restaurants.filter(r => area === Utils.BaseString(r.area))
    }
    if (food) {
        restaurants = restaurants.filter(r => food=== Utils.BaseString(r.food))
    }
    if (name) {
        restaurants = restaurants.filter(r => name === Utils.BaseString(r.name))
    }
    if (pricerange) {
        restaurants = restaurants.filter(r => pricerange === Utils.BaseString(r.pricerange))
    }

    var failed = false;
    if (failInfo != undefined && restaurants.length === 1) {
        const failChecks = new Map<string, string | null>([
            ["area", area],
            ["food", food],
            ["name", name],
            ["pricerange", pricerange],
            ["time", time]
        ])
        restaurants = FilterFails(restaurants, failInfo, failChecks)
        if (restaurants.length == 0) {
            failed = true;
        }
    }

    return [pickone ? restaurants.slice(0, 1) : restaurants, failed]
}

const AttractionOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo: { [id: string]: string }): [Attraction[], boolean] => {

    const pickone = memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)
    const pickedname = memoryManager.Get(AttractionSlot.NAME, ClientMemoryManager.AS_STRING_LIST)

    const area = Utils.MemoryValue(LuisSlot.AREA, memoryManager)
    const name = Utils.MemoryValue(LuisSlot.NAME, memoryManager)
    const _type = Utils.MemoryValue(LuisSlot.TYPE, memoryManager)

    let attractions = AttractionDb()
    if (pickone && pickedname?.length == 1) {
        var pickbase = Utils.BaseString(pickedname[0])
        attractions = attractions.filter(r => pickbase === Utils.BaseString(r.name))
    }
    if (area) {
        attractions = attractions.filter(r => area === Utils.BaseString(r.area))
    }
    if (name) {
        attractions = attractions.filter(r => name === Utils.BaseString(r.name))
    }
    if (_type) {
        attractions = attractions.filter(r => _type === Utils.BaseString(r._type))
    }

    var failed = false;
    if (failInfo != undefined && attractions.length == 1) {
        const failChecks = new Map<string, string | null>([
            ["area", area],
            ["name", name],
            ["type", _type],
        ])
        attractions = FilterFails(attractions, failInfo, failChecks)
        if (attractions.length == 0) {
            failed = true;
        }
    }

    if (pickone) {
        let free = attractions.filter(a => a.entrancefee === "free")
        if (free.length > 0) {
            return [free.slice(0, 1), failed]
        }
        else {
            return [attractions.slice(0, 1), failed]
        }
    }
    return [attractions, failed]
}

const HotelOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo: { [id: string]: string }): [Hotel[], boolean] => {

    const pickone = memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)
    const pickedname = memoryManager.Get(HotelSlot.NAME, ClientMemoryManager.AS_STRING_LIST)

    const name = Utils.MemoryValue(LuisSlot.NAME, memoryManager)
    const area = Utils.MemoryValue(LuisSlot.AREA, memoryManager)
    const internet_yes =  Utils.MemoryValue(LuisSlot.INTERNET_YES, memoryManager)
    //const internet_no =  Utils.MemoryValue(LuisSlot.INTERNET_NO,  memoryManager)
    const parking_yes =  Utils.MemoryValue(LuisSlot.PARKING_YES,  memoryManager)
    //const parking_no =  Utils.MemoryValue(LuisSlot.PARKING_NO,  memoryManager)
    const pricerange = Utils.MemoryValue(LuisSlot.PRICE,  memoryManager)
    const stars = Utils.MemoryValue(LuisSlot.STARS,  memoryManager)
    const _type = Utils.MemoryValue(LuisSlot.TYPE,  memoryManager)

    // Non-filtered options
    const people = Utils.MemoryValue(LuisSlot.PEOPLE, memoryManager)
    const day = Utils.MemoryValue(LuisSlot.DAY, memoryManager)
    const stay = Utils.MemoryValue(LuisSlot.STAY, memoryManager)
    //takesbookings - unused

    let hotels = HotelDb()
    if (pickone && pickedname?.length == 1) {
        var pickbase = Utils.BaseString(pickedname[0])
        hotels = hotels.filter(r => pickbase === Utils.BaseString(r.name))
    }
    if (area) {
        hotels = hotels.filter(r => area == Utils.BaseString(r.area))
    }
    if (internet_yes) {
        hotels = hotels.filter(r => r.internet === "yes")
    }
    if (parking_yes) {
        hotels = hotels.filter(r => r.parking === "yes")
    }
    if (name) {
        hotels = hotels.filter(r => name === Utils.BaseString(r.name))
    }
    if (pricerange) {
        hotels = hotels.filter(r => pricerange === Utils.BaseString(r.pricerange))
    }
    if (stars) {
        hotels = hotels.filter(r => stars === Utils.BaseString(r.stars))
    }

    // "hotel" can be interpreted as "hotel" + "guesthouse" or as a filter so try both
    if (_type) { 

        // Always filter on guesthouse
        if (_type == "guesthouse") {
            hotels = hotels.filter(r => _type === Utils.BaseString(r._type))    
        }
        // Only use "hotel" as filter if it doesn't zero out possibilities
        else {
            let hotelsOnly = hotels.filter(r => _type === Utils.BaseString(r._type))
            if (_type == "hotel" && hotelsOnly.length > 0) {
                hotels = hotelsOnly;
            }
        }
    }

    var failed = false;
    if (failInfo != undefined && hotels.length === 1) {
        const failChecks = new Map<string, string | null>([
            ["area", area],
            ["internet", internet_yes],
            ["parking", parking_yes],
            ["name", name],
            ["pricerange", pricerange],
            ["stars", stars],
            ["type", _type],
            ["people", people],
            ["day", day],
            ["stay", stay]
        ])
        hotels = FilterFails(hotels, failInfo, failChecks)
        if (hotels.length == 0) {
            failed = true;
        }
    }

    return [pickone ? hotels.slice(0, 1) : hotels, failed]
}

const TrainOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo: { [id: string]: string }): [Train[], boolean] => {

    const pickone = memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)
    const pickedname = memoryManager.Get(TrainSlot.ID, ClientMemoryManager.AS_STRING_LIST)

    const day = Utils.MemoryValue(LuisSlot.DAY, memoryManager)
    const departure = Utils.MemoryValue(LuisSlot.DEPART, memoryManager)
    const destination =  Utils.MemoryValue(LuisSlot.DESTINATION, memoryManager)

    //TODO entracneFree / price /etc no semantics ??

    let trains = TrainDb()
    if (pickone && pickedname?.length == 1) {
        var pickbase = Utils.BaseString(pickedname[0])
        trains = trains.filter(r => pickbase=== r.trainID)
    }
    if (day) {
        trains = trains.filter(r => day === Utils.BaseString(r.day))
    }
    if (departure) {
        trains = trains.filter(r => departure === Utils.BaseString(r.departure))
    }
    if (destination) {
        trains = trains.filter(r => destination === Utils.BaseString(r.destination))
    }
    // Filter on times based on LUIS slot is set (because not exact match)
    // Can't provide times unless I know where I'm going
    if ((departure || [...new Set(trains.map(t => t.departure))].length == 1)
        && (destination || [...new Set(trains.map(t => t.destination))].length == 1)
        && (day || [...new Set(trains.map(t => t.day))].length == 1)) {
        const leaveAt = memoryManager.Get(LuisSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)
        const arriveBy = memoryManager.Get(LuisSlot.ARRIVE_BY, ClientMemoryManager.AS_STRING)
        var bestTrain = null;
        if (leaveAt && !isNaN(Utils.parseTime(leaveAt)) && arriveBy && !isNaN(Utils.parseTime(arriveBy)))
        {
            bestTrain = Utils.trainBetween(trains, leaveAt, arriveBy)
        }
        if (bestTrain == null && leaveAt && !isNaN(Utils.parseTime(leaveAt))) {
            bestTrain = Utils.trainLeaveAfter(trains, leaveAt)
        }
        if (bestTrain == null && arriveBy && !isNaN(Utils.parseTime(arriveBy))) {
            bestTrain = Utils.trainArriveBefore(trains, arriveBy)
        }
        trains = bestTrain ? [bestTrain] : []
    }
    // Only pick one if I know where I'm going
    if (departure && destination) {
        return [pickone ? trains.slice(0, 1) : trains, false] 
    }
    return [trains, false]
}

const TaxiOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo: { [id: string]: string }): Taxi[] => {
    return TaxiDb()
}

const PoliceOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Police[] => {
    return PoliceDb()
}

const HospitalOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Hospital[] => {

    const department = Utils.MemoryValue(LuisSlot.DEPARTMENT, memoryManager)

    let hospitals = HospitalDb()
    if (department) {
        hospitals = hospitals.filter(r => department === Utils.BaseString(r.department))
    }

    return hospitals.slice(0, 1)
}

const FilterFails = (items: any[], failInfo: { [id: string]: string }, checks: Map<string, string | null>) => {
    if (Object.keys(failInfo).length == 0) {
        return items
    }

    let matchCount = 0
    checks.forEach((value: string | null, key: string) => {
        let failKey = Utils.BaseString(failInfo[key])
        // Is there a fail info for this key 
        if (failKey) {
            // If there is, check if I match it and count
            if (value == failKey) {
                matchCount++ 
            }
        }
    })
    // If I matched all conditions, Fail filter has triggered
    if (matchCount == Object.keys(failInfo).length) {
        return []
    }

    return items

}

let _restaurantDb: Restaurant[] = []
let _attractionDb: Attraction[] = []
let _hotelDb: Hotel[] = []
let _taxiDb: Taxi[] = []
let _trainDb: Train[] = []
let _policeDb: Police[] = []
let _hospitalDb: Hospital[] = []
let _entitySubstitutions: { [key: string]: string }
let _dialogActs: string[]

const RestaurantDb = (): Restaurant[] => {
    if (_restaurantDb.length == 0) {
        _restaurantDb = LoadDataBase("restaurant_db")
        for (var index in _restaurantDb) {
            _restaurantDb[index].ref = index.padStart(8,"0");
        }
    }

    return _restaurantDb
}
const AttractionDb = (): Attraction[] => {
    if (_attractionDb.length == 0) {
        _attractionDb = LoadDataBase("attraction_db")

        for (var attraction of _attractionDb) {
            if (attraction.entrancefee == "?") {
                attraction.entrancefee = "unknown"
            }
        }
        for (var index in _attractionDb) {
            _attractionDb[index].ref = index.padStart(8,"0");
        }
    }
    return _attractionDb
}
const HotelDb = (): Hotel[] => {
    if (_hotelDb.length == 0) {
        _hotelDb = LoadDataBase("hotel_db")
        for (var index in _hotelDb) {
            _hotelDb[index].ref = index.padStart(8,"0");
        }
    }
    return _hotelDb
}
const TaxiDb = (): Taxi[] => {
    if (_taxiDb.length == 0) {
        _taxiDb = LoadDataBase("taxi_db")
    }
    return [_taxiDb as any]
}
const TrainDb = (): Train[] => {
    if (_trainDb.length == 0) {
        _trainDb = LoadDataBase("train_db")
        for (var index in _trainDb) {
            _trainDb[index].ref = index.padStart(8,"0");
        }
    }
    return _trainDb
}
const PoliceDb = (): Police[] => {
    if (_policeDb.length == 0) {
        _policeDb = LoadDataBase("police_db")
    }
    return _policeDb
}
const HospitalDb = (): Hospital[] => {
    if (_hospitalDb.length == 0) {
        _hospitalDb = LoadDataBase("hospital_db")
    }
    return _hospitalDb
}
const LoadDataBase = (databaseName: string): any => {
    const filename = path.join(GetDirectory(DBDirectory), `${databaseName}.json`)
    const templateString = fs.readFileSync(filename, 'utf-8')
    const template = JSON.parse(templateString
        .split('"type":').join('"_type":')
        .split('"entrance fee":').join('"entrancefee":'))
    return template
}

