/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as path from 'path'
import { ClientMemoryManager, ReadOnlyClientMemoryManager } from 'clwoz-sdk'
import { Restaurant, Hotel, Attraction, Taxi, Train, LuisSlot, RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, Domain, PICK_ONE } from './dataTypes'
import * as fs from 'fs'
import * as Utils from './utils'
import * as Test from './test'

const DBDirectory = 'mwdb'
const SIMILARITY_THRESHOLD = 7
export const TestDirectory = 'testtranscripts'
export const ResultsDirectory = 'testresults'
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
    for (const attraction of AttractionDb()) {
        attractionTypes.push(attraction._type)
        if (attraction.pricerange != "?") {
            priceTypes.push(attraction.pricerange)
        }
        areaTypes.push(attraction.area)
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

    _slotTypes = new Map<string, string[]>()
    _slotTypes.set("attractiontype", attractionTypes)
    _slotTypes.set("pricerange", priceTypes)
    _slotTypes.set("area", areaTypes)
    _slotTypes.set("food", foodTypes)
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

export const ResolveEntityValue = (entityValue: string, entityName: string, domainName: string) => {
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
    else if (entityName == "pricerange" && cleanValue != "?") {
        return ResolveItem(cleanValue, SlotTypes().get("pricerange")!)
    }
    else if (entityName == "area") {
        return ResolveItem(cleanValue, SlotTypes().get("area")!)
    }
    else if (entityName == "food") {
        return ResolveItem(cleanValue, SlotTypes().get("food")!)
    }
    return cleanValue
}

export const ResolveItem = (name: string, values: string[]) => {

    if (name == "dontcare") {
        return name
    }

    // Try containment
    const match = values.find(h => h.indexOf(name) >= 0)
    if (match != null) {
        return match
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
        return best
    }
    else {
        return name
    }
}

const ResolveName = (name: string, items: any[], preString: string, postString: string) => {
    let before = `${preString} `
    let after = ` ${postString}`

    // First check raw name
    if (items.find(h => h.name == name)) {
        return name
    }

    // i.e. " hotel"
    if (name.indexOf(after) >= 0) {
        const shortName = name.replace(after, "")
        if (items.find(h => h.name == shortName)) {
            return shortName
        }
    }
    else {
        // Otherwise try adding " hotel"
        const longName = `{name}{after}`
        if (HotelDb().find(h => h.name == longName)) {
            return longName
        }
    }

    // i.e. "the "
    if (name.indexOf(before) >= 0) {
        const shortName = name.replace(before, "")
        if (items.find(h => h.name == shortName)) {
            return shortName
        }
    }
    else {
        // Otherwise try adding "the "
        const longName = `{before}{name}`
        if (items.find(h => h.name == longName)) {
            return longName
        }
    }

    // Try without either
    if (name.indexOf(before) >= 0 && name.indexOf(after) >= 0) {
        let shortName = name.replace(before, "")
        shortName = shortName.replace(after, "")
        if (items.find(h => h.name == shortName)) {
            return shortName
        }
    }

    // Try containment
    const match = items.find(h => h.name.indexOf(name) >= 0)
    if (match != null) {
        return match.name
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
        return best
    }
    else {
        return name
    }
}

export const UpdateEntities = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    UpdateDomain(memoryManager, domainFilter)
    UpdateDB(memoryManager, domainFilter)
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
        else {
            return
        }
    }
    if (domainFilter === "restaurant") {
        if (day) {
            memoryManager.Delete(RestaurantSlot.DAY)
            memoryManager.Set(RestaurantSlot.DAY, day)
        }
        if (people) {
            memoryManager.Delete(RestaurantSlot.PEOPLE)
            memoryManager.Set(RestaurantSlot.PEOPLE, people)
        }
        if (time) {
            memoryManager.Delete(RestaurantSlot.TIME)
            memoryManager.Set(RestaurantSlot.TIME, time)
        }
        if (area) {
            memoryManager.Delete(RestaurantSlot.AREA)
            memoryManager.Set(RestaurantSlot.AREA, area)
        }
        if (food) {
            memoryManager.Delete(RestaurantSlot.FOOD)
            memoryManager.Set(RestaurantSlot.FOOD, food)
        }
        if (name) {
            memoryManager.Delete(RestaurantSlot.NAME)
            memoryManager.Set(RestaurantSlot.NAME, name)
        }
        if (price) {
            memoryManager.Delete(RestaurantSlot.PRICERANGE)
            memoryManager.Set(RestaurantSlot.PRICERANGE, price)
        }
        return
    }
    if (domainFilter === "train") {
        if (people) {
            memoryManager.Delete(TrainSlot.PEOPLE)
            memoryManager.Set(TrainSlot.PEOPLE, people)
        }
    /*  LARS   if (arrive) {
            memoryManager.Delete(TrainSlot.ARRIVE_BY)
            // DO NOT SET: ArriveBy is different from train arrival time
            // memoryManager.Set(TrainSlot.ARRIVE_BY, arrive)
        }*/
        if (day) {
            memoryManager.Delete(TrainSlot.DAY)
            memoryManager.Set(TrainSlot.DAY, day)
        }
        if (depart) {
            memoryManager.Delete(TrainSlot.DEPART)
            memoryManager.Set(TrainSlot.DEPART, depart)
        }
        if (dest) {
            memoryManager.Delete(TrainSlot.DESTINATION)
            memoryManager.Set(TrainSlot.DESTINATION, dest)
        }/* LARS
        if (leave) {
            memoryManager.Delete(TrainSlot.LEAVE_AT)
            // DO NOT SET: LeaveAt is different from train leave time
            //memoryManager.Set(TrainSlot.LEAVE_AT, leave)
        }*/
        return
    }
    if (domainFilter === "hotel") {
        if (day) {
            memoryManager.Delete(HotelSlot.DAY)
            memoryManager.Set(HotelSlot.DAY, day)
        }
        if (people) {
            memoryManager.Delete(HotelSlot.PEOPLE)
            memoryManager.Set(HotelSlot.PEOPLE, people)
        }
        if (stay) {
            memoryManager.Delete(HotelSlot.STAY)
            memoryManager.Set(HotelSlot.STAY, stay)
        }
        if (area) {
            memoryManager.Delete(HotelSlot.AREA)
            memoryManager.Set(HotelSlot.AREA, area)
        }
        if (internetYes) {
            memoryManager.Delete(HotelSlot.INTERNET)
            memoryManager.Set(HotelSlot.INTERNET, "yes")
        }
        if (internetNo) {
            memoryManager.Delete(HotelSlot.INTERNET)
            memoryManager.Set(HotelSlot.INTERNET, "no")
        }
        if (name) {
            memoryManager.Delete(HotelSlot.NAME)
            memoryManager.Set(HotelSlot.NAME, name)
        }
        if (parkingYes) {
            memoryManager.Delete(HotelSlot.PARKING)
            memoryManager.Set(HotelSlot.PARKING, "yes")
        }
        if (parkingNo) {
            memoryManager.Delete(HotelSlot.PARKING)
            memoryManager.Set(HotelSlot.PARKING, "no")
        }
        if (price) {
            memoryManager.Delete(HotelSlot.PRICERANGE)
            memoryManager.Set(HotelSlot.PRICERANGE, price)
        }
        if (stars) {
            memoryManager.Delete(HotelSlot.STARS)
            memoryManager.Set(HotelSlot.STARS, stars)
        }
        if (type_) {
            memoryManager.Delete(HotelSlot.TYPE)
            memoryManager.Set(HotelSlot.TYPE, type_)
        }
    }
    if (domainFilter === "taxi") {
        if (arrive) {
            memoryManager.Delete(TaxiSlot.ARRIVE_BY)
            memoryManager.Set(TaxiSlot.ARRIVE_BY, arrive)
        }
        if (depart) {
            memoryManager.Delete(TaxiSlot.DEPART)
            memoryManager.Set(TaxiSlot.DEPART, depart)
        }
        if (dest) {
            memoryManager.Delete(TaxiSlot.DESTINATION)
            memoryManager.Set(TaxiSlot.DESTINATION, dest)
        }
        if (leave) {
            memoryManager.Delete(TaxiSlot.LEAVE_AT)
            memoryManager.Set(TaxiSlot.LEAVE_AT, leave)
        }
        return
    }
    if (domainFilter === "attraction") {
        if (area) {
            memoryManager.Delete(AttractionSlot.AREA)
            memoryManager.Set(AttractionSlot.AREA, area)
        }
        if (name) {
            memoryManager.Delete(AttractionSlot.NAME)
            memoryManager.Set(AttractionSlot.NAME, name)
        }
        if (type_) {
            memoryManager.Delete(AttractionSlot.TYPE)
            memoryManager.Set(AttractionSlot.TYPE, type_)
        }
        return
    }
}

const SetEntities = (items: string[], luisSlotName: any, slotName: any, countSlotName: any, memoryManager: ClientMemoryManager) => {

    // If LUIS hasn't already filled this entity, don't use database value
    if (!luisSlotName || !memoryManager.Get(luisSlotName, ClientMemoryManager.AS_STRING)) {

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

        const restaurants = RestaurantOptions(memoryManager, failInfo)

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
        memoryManager.Delete(RestaurantSlot.CHOICE_TWO)
        memoryManager.Delete(RestaurantSlot.CHOICE_MANY)

        memoryManager.Set(RestaurantSlot.CHOICE, restaurants.length)
        if (restaurants.length == 0) {
            memoryManager.Set(RestaurantSlot.CHOICE_NONE, true)
        }
        else if (restaurants.length == 2) {
            memoryManager.Set(RestaurantSlot.CHOICE_TWO, true)
        }
        else if (restaurants.length > 2) {
            memoryManager.Set(RestaurantSlot.CHOICE_MANY, true)
        }
    }
    if (domainFilter == "hotel") {

        let failInfo: { [id: string]: string } = {}
        if (Test.TestGoal) {
            failInfo = { ...Test.TestGoal.hotel.fail_book, ...Test.TestGoal.hotel.fail_info }
        }

        const hotels = HotelOptions(memoryManager, failInfo)

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
        memoryManager.Delete(HotelSlot.CHOICE_TWO)
        memoryManager.Delete(HotelSlot.CHOICE_MANY)

        memoryManager.Set(HotelSlot.CHOICE, hotels.length)
        if (hotels.length == 0) {
            memoryManager.Set(HotelSlot.CHOICE_NONE, true)
        }
        else if (hotels.length == 2) {
            memoryManager.Set(HotelSlot.CHOICE_TWO, true)
        }
        else if (hotels.length > 2) {
            memoryManager.Set(HotelSlot.CHOICE_MANY, true)
        }
    }
    if (domainFilter == "attraction") {

        let failInfo: { [id: string]: string } = {}
        if (Test.TestGoal) {
            failInfo = { ...Test.TestGoal.attraction.fail_book, ...Test.TestGoal.attraction.fail_info }
        }

        const attractions = AttractionOptions(memoryManager, failInfo)

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
        memoryManager.Delete(AttractionSlot.CHOICE_TWO)
        memoryManager.Delete(AttractionSlot.CHOICE_MANY)

        memoryManager.Set(AttractionSlot.CHOICE, attractions.length)
        if (attractions.length == 0) {
            memoryManager.Set(AttractionSlot.CHOICE_NONE, true)
        }
        else if (attractions.length == 2) {
            memoryManager.Set(AttractionSlot.CHOICE_TWO, true)
        }
        else if (attractions.length > 2) {
            memoryManager.Set(AttractionSlot.CHOICE_MANY, true)
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
        memoryManager.Set(TaxiSlot.CHOICE, 1)
        memoryManager.Set(TaxiSlot.CHOICE_NONE, true)

        const colors = taxis[0].taxi_colors
        const types = taxis[0].taxi_types
        //const phones = taxis[0].taxi_phone

        const color = colors[Math.floor(Math.random() * colors.length)]
        const _type = types[Math.floor(Math.random() * types.length)]
        //const phone = phones[Math.floor(Math.random() * phone.length)];

        memoryManager.Set(TaxiSlot.CAR, `${color} ${_type}`)
        memoryManager.Set(TaxiSlot.PHONE, "555-5555")
    }

    if (domainFilter == "train") {

        let failInfo: { [id: string]: string } = {}
        if (Test.TestGoal) {
            failInfo = { ...Test.TestGoal.train.fail_book, ...Test.TestGoal.train.fail_info }
        }

        const trains = TrainOptions(memoryManager, failInfo)

        const arriveBys = [... new Set(trains.map(a => a.arriveBy))]
        // Null LUIS slot as times are diff
        SetEntities(arriveBys, null, TrainSlot.ARRIVE_BY, TrainSlot.ARRIVE_BY_COUNT, memoryManager)

        const days = [... new Set(trains.map(a => a.day))]
        SetEntities(days, null, TrainSlot.DAY, TrainSlot.DAY_COUNT, memoryManager)

        const departures = [... new Set(trains.map(a => a.departure))]
        SetEntities(departures, LuisSlot.DESTINATION, TrainSlot.DEPART, TrainSlot.DEPART_COUNT, memoryManager)

        const destinations = [... new Set(trains.map(a => a.destination))]
        SetEntities(destinations, LuisSlot.DESTINATION, TrainSlot.DESTINATION, TrainSlot.DESTINATION_COUNT, memoryManager)

        const durations = [... new Set(trains.map(a => a.duration))]
        SetEntities(durations, null, TrainSlot.DURATION, TrainSlot.DURATION_COUNT, memoryManager)

        const leaveAts = [... new Set(trains.map(a => a.leaveAt))]
        // Null LUIS slot as times are diff
        SetEntities(leaveAts, null, TrainSlot.LEAVE_AT, TrainSlot.LEAVE_AT_COUNT, memoryManager)

        const prices = [... new Set(trains.map(a => a.price))]
        SetEntities(prices, null, TrainSlot.TICKET, TrainSlot.TICKET_COUNT, memoryManager)

        const trainIDs = [... new Set(trains.map(a => a.trainID))]
        SetEntities(trainIDs, null, TrainSlot.ID, TrainSlot.ID_COUNT, memoryManager)

        memoryManager.Delete(TrainSlot.CHOICE_NONE)
        memoryManager.Delete(TrainSlot.CHOICE_TWO)
        memoryManager.Delete(TrainSlot.CHOICE_MANY)

        memoryManager.Set(TrainSlot.CHOICE, trains.length)
        if (trains.length == 0) {
            memoryManager.Set(TrainSlot.CHOICE_NONE, true)
        }
        else if (trains.length == 2) {
            memoryManager.Set(TrainSlot.CHOICE_TWO, true)
        }
        else if (trains.length > 2) {
            memoryManager.Set(TrainSlot.CHOICE_MANY, true)
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
    }
}

const trainEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    const trains = TrainOptions(memoryManager)

    Object.values(TrainSlot).map((entityName: string) => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
        else if (trains.length == 1) {
            const key = Utils.propertyName(entityName) as keyof Train
            entities.push(`${entityName}: ${trains[0][key]}`)
        }
    })
    return entities
}

const restaurantEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    const restaurants = RestaurantOptions(memoryManager)
    if (restaurants.length == 1) {
        entities.push(`restaurant-ref: ${Utils.makeId(8)}`)
    }

    Object.values(RestaurantSlot).map(entityName => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
        else if (restaurants.length == 1) {
            const key = Utils.propertyName(entityName) as keyof Restaurant
            entities.push(`${entityName}: ${restaurants[0][key]}`)
        }
    })
    return entities
}

const hotelEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    const hotels = HotelOptions(memoryManager)
    if (hotels.length == 1) {
        entities.push(`hotel-ref: ${Utils.makeId(8)}`)
    }

    Object.values(HotelSlot).map(entityName => {
        const value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
        else if (hotels.length == 1) {
            const key = Utils.propertyName(entityName) as keyof Hotel
            entities.push(`${entityName}: ${hotels[0][key]}`)
        }
    })

    return entities
}

const attractionEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    const attractions = AttractionOptions(memoryManager)

    Object.values(AttractionSlot).map(entityName => {
        const values = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (values) {
            entities.push(`${entityName}: ${values}`)
        }
        else if (attractions.length == 1) {
            const key = Utils.propertyName(entityName) as keyof Attraction
            entities.push(`${entityName}: ${attractions[0][key]}`)
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

const RestaurantOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo?: { [id: string]: string }): Restaurant[] => {

    const pickone = memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)
    const name = Utils.MemoryValues(RestaurantSlot.NAME, RestaurantSlot.NAME_COUNT, memoryManager)
    const luisName = memoryManager.Get(LuisSlot.NAME, ClientMemoryManager.AS_STRING)
    const picked = luisName || (name.length == 1 && pickone)

    // If I've pickone, only filter by name
    const area = picked ? [] : Utils.MemoryValues(RestaurantSlot.AREA, RestaurantSlot.AREA_COUNT, memoryManager)
    const food = picked ? [] : Utils.MemoryValues(RestaurantSlot.FOOD, RestaurantSlot.FOOD_COUNT, memoryManager)
    const pricerange = picked ? [] : Utils.MemoryValues(RestaurantSlot.PRICERANGE, RestaurantSlot.PRICERANGE_COUNT, memoryManager)
    
    // Non-filtered value
    const time = memoryManager.Get(RestaurantSlot.TIME, ClientMemoryManager.AS_STRING_LIST)

    let restaurants = RestaurantDb()
    if (area.length > 0) {
        restaurants = restaurants.filter(r => area.includes(Utils.BaseString(r.area)))
    }
    if (food.length > 0) {
        restaurants = restaurants.filter(r => food.includes(Utils.BaseString(r.food)))
    }
    if (name.length == 1) {
        restaurants = restaurants.filter(r => name.includes(Utils.BaseString(r.name)))
    }
    if (pricerange.length > 0) {
        restaurants = restaurants.filter(r => pricerange.includes(Utils.BaseString(r.pricerange)))
    }

    if (failInfo != undefined) {
        const failChecks = new Map<string, string[]>([
            ["area", area],
            ["food", food],
            ["name", name],
            ["pricerange", pricerange],
            ["time", time]
        ])
        restaurants = FilterFails(restaurants, failInfo, failChecks)
    }

    return pickone ? restaurants.slice(0, 1) : restaurants
}

const AttractionOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo?: { [id: string]: string }): Attraction[] => {

    const pickone = memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)
    const name = Utils.MemoryValues(AttractionSlot.NAME, AttractionSlot.NAME_COUNT, memoryManager)
    const luisName = memoryManager.Get(LuisSlot.NAME, ClientMemoryManager.AS_STRING)  
    const picked = luisName || (name.length == 1 && pickone)

    // If I've pickone, only filter by name
    const area = picked ? [] : Utils.MemoryValues(AttractionSlot.AREA, AttractionSlot.AREA_COUNT, memoryManager)
    const _type = picked ? [] : Utils.MemoryValues(AttractionSlot.TYPE, AttractionSlot.TYPE_COUNT, memoryManager)

    let attractions = AttractionDb()
    if (area.length > 0) {
        attractions = attractions.filter(r => area.includes(Utils.BaseString(r.area)))
    }
    if (name.length == 1) {
        attractions = attractions.filter(r => name.includes(Utils.BaseString(r.name)))
    }
    if (_type.length > 0) {
        attractions = attractions.filter(r => _type.includes(Utils.BaseString(r._type)))
    }

    if (failInfo != undefined) {
        const failChecks = new Map<string, string[]>([
            ["area", area],
            ["name", name],
            ["type", _type],
        ])
        attractions = FilterFails(attractions, failInfo, failChecks)
    }

    if (pickone) {
        let free = attractions.filter(a => a.entrancefee === "free")
        if (free.length > 0) {
            return free.slice(0, 1)
        }
        else {
            return attractions.slice(0, 1)
        }
    }
    return attractions
}

const HotelOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo?: { [id: string]: string }): Hotel[] => {

    const pickone = memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)
    const name = Utils.MemoryValues(HotelSlot.NAME, HotelSlot.NAME_COUNT, memoryManager)
    const luisName = memoryManager.Get(LuisSlot.NAME, ClientMemoryManager.AS_STRING)
    const picked = luisName || (name.length == 1 && pickone)

    // If I've pickone, only filter by name
    const area = picked ? [] : Utils.MemoryValues(HotelSlot.AREA, HotelSlot.AREA_COUNT, memoryManager)
    const internet = picked ? [] : Utils.MemoryValues(HotelSlot.INTERNET, HotelSlot.INTERNET_COUNT, memoryManager)
    const parking = picked ? [] : Utils.MemoryValues(HotelSlot.PARKING, HotelSlot.PARKING_COUNT, memoryManager)
    const pricerange = picked ? [] : Utils.MemoryValues(HotelSlot.PRICERANGE, HotelSlot.PRICERANGE_COUNT, memoryManager)
    const stars = picked ? [] : Utils.MemoryValues(HotelSlot.STARS, HotelSlot.STARS_COUNT, memoryManager)
    const _type = picked ? [] : Utils.MemoryValues(HotelSlot.TYPE, HotelSlot.TYPE_COUNT, memoryManager)

    // Non-filtered options
    const people = Utils.MemoryValues(HotelSlot.PEOPLE, null, memoryManager)
    const day = Utils.MemoryValues(HotelSlot.DAY, null, memoryManager)
    const stay = Utils.MemoryValues(HotelSlot.STAY, null, memoryManager)
    //takesbookings - unused

    let hotels = HotelDb()
    if (area.length > 0) {
        hotels = hotels.filter(r => area.includes(Utils.BaseString(r.area)))
    }
    if (internet.includes("yes") && !internet.includes("no")) {
        hotels = hotels.filter(r => r.internet === "yes")
    }
    if (parking.includes("yes") && !parking.includes("no")) {
        hotels = hotels.filter(r => r.parking === "yes")
    }
    if (name.length == 1) {
        hotels = hotels.filter(r => name.includes(Utils.BaseString(r.name)))
    }
    if (pricerange.length > 0) {
        hotels = hotels.filter(r => pricerange.includes(Utils.BaseString(r.pricerange)))
    }
    if (stars.length > 0) {
        hotels = hotels.filter(r => stars.includes(Utils.BaseString(r.stars)))
    }
    if (_type.length > 0) {
        hotels = hotels.filter(r => _type.includes(Utils.BaseString(r._type)))
    }

    if (failInfo != undefined) {
        const failChecks = new Map<string, string[]>([
            ["area", area],
            ["internet", internet],
            ["parking", parking],
            ["name", name],
            ["pricerange", pricerange],
            ["stars", stars],
            ["type", _type],
            ["people", people],
            ["day", day],
            ["stay", stay]
        ])
        hotels = FilterFails(hotels, failInfo, failChecks)
    }

    return pickone ? hotels.slice(0, 1) : hotels
}

const TrainOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo?: { [id: string]: string }): Train[] => {

    const day = Utils.MemoryValues(TrainSlot.DAY, TrainSlot.DAY_COUNT, memoryManager)
    const departure = Utils.MemoryValues(TrainSlot.DEPART, TrainSlot.DEPART_COUNT, memoryManager)
    const destination = Utils.MemoryValues(TrainSlot.DESTINATION, TrainSlot.DESTINATION_COUNT, memoryManager)
    const pickone = memoryManager.Get(PICK_ONE, ClientMemoryManager.AS_STRING)
    //TODO entracneFree / price /etc no semantics ??

    let trains = TrainDb()
    if (day.length > 0) {
        trains = trains.filter(r => day.includes(Utils.BaseString(r.day)))
    }
    if (departure.length > 0) {
        trains = trains.filter(r => departure.includes(Utils.BaseString(r.departure)))
    }
    if (destination.length > 0) {
        trains = trains.filter(r => destination.includes(Utils.BaseString(r.destination)))
    }
    // Filter on times based on LUIS slot is set (because not exact match)
    if (departure.length > 0 && destination.length > 0 && day.length > 0) {
        const leaveAt = memoryManager.Get(LuisSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)
        if (leaveAt && !isNaN(Utils.parseTime(leaveAt))) {
            const bestTrain = Utils.trainLeaveAfter(trains, leaveAt)
            trains = bestTrain ? [bestTrain] : []
        }
        const arriveBy = memoryManager.Get(LuisSlot.ARRIVE_BY, ClientMemoryManager.AS_STRING)
        if (arriveBy && !isNaN(Utils.parseTime(arriveBy))) {
            const bestTrain = Utils.trainArriveBefore(trains, arriveBy)
            trains = bestTrain ? [bestTrain] : []
        }
    }
    return pickone ? trains.slice(0, 1) : trains
}

const TaxiOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager, failInfo?: { [id: string]: string }): Taxi[] => {
    return TaxiDb()
}

const FilterFails = (items: any[], failInfo: { [id: string]: string }, checks: Map<string, string[]>) => {
    if (Object.keys(failInfo).length == 0) {
        return items
    }

    let matchCount = 0
    checks.forEach((value: string[], key: string) => {
        let failKey = failInfo[key]
        // Is there a fail info for this key 
        if (failKey) {
            // If there is, check if I match it and count
            if (value.includes(failKey)) {
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
let _entitySubstitutions: { [key: string]: string }
let _dialogActs: string[]

const RestaurantDb = (): Restaurant[] => {
    if (_restaurantDb.length == 0) {
        _restaurantDb = LoadDataBase("restaurant_db")
    }
    return _restaurantDb
}
const AttractionDb = (): Attraction[] => {
    if (_attractionDb.length == 0) {
        _attractionDb = LoadDataBase("attraction_db")
    }
    return _attractionDb
}
const HotelDb = (): Hotel[] => {
    if (_hotelDb.length == 0) {
        _hotelDb = LoadDataBase("hotel_db")
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
    }
    return _trainDb
}

const LoadDataBase = (databaseName: string): any => {
    const filename = path.join(GetDirectory(DBDirectory), `${databaseName}.json`)
    const templateString = fs.readFileSync(filename, 'utf-8')
    const template = JSON.parse(templateString
        .split('"type":').join('"_type":')
        .split('"entrance fee":').join('"entrancefee":'))
    return template
}

