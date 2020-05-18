/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as path from 'path'
import { ClientMemoryManager, ReadOnlyClientMemoryManager } from '@conversationlearner/sdk'
import config from './config'
import { Restaurant, Hotel, Attraction, Taxi, Train, LuisSlot, RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, Domain } from './dataTypes'
import * as fs from 'fs'
import * as Utils from './utils'

console.log(`Config:\n`, JSON.stringify(config, null, '  '))

const DBDirectory = 'mwdb'
export const TestDirectory = 'testtranscripts'
export const ResultsDirectory = 'testresults'
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

export const UpdateEntities = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    UpdateDomain(memoryManager, domainFilter)
    UpdateDB(memoryManager, domainFilter)
}

// Move items from general to domain specific and then clear general
const UpdateDomain = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    var day = memoryManager.Get(LuisSlot.DAY, ClientMemoryManager.AS_STRING)
    var people = memoryManager.Get(LuisSlot.PEOPLE, ClientMemoryManager.AS_STRING)
    var time = memoryManager.Get(LuisSlot.TIME, ClientMemoryManager.AS_STRING)
    var area = memoryManager.Get(LuisSlot.AREA, ClientMemoryManager.AS_STRING)
    var food = memoryManager.Get(LuisSlot.FOOD, ClientMemoryManager.AS_STRING)
    var price = memoryManager.Get(LuisSlot.PRICE, ClientMemoryManager.AS_STRING)
    var arrive = memoryManager.Get(LuisSlot.ARRIVE_BY, ClientMemoryManager.AS_STRING)
    var depart = memoryManager.Get(LuisSlot.DEPART, ClientMemoryManager.AS_STRING)
    var dest = memoryManager.Get(LuisSlot.DESTINATION, ClientMemoryManager.AS_STRING)
    var leave = memoryManager.Get(LuisSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)
    var stay = memoryManager.Get(LuisSlot.STAY, ClientMemoryManager.AS_STRING)
    var internetYes = memoryManager.Get(LuisSlot.INTERNET_YES, ClientMemoryManager.AS_STRING)
    var internetNo = memoryManager.Get(LuisSlot.INTERNET_NO, ClientMemoryManager.AS_STRING)
    var name = memoryManager.Get(LuisSlot.NAME, ClientMemoryManager.AS_STRING)
    var parkingYes = memoryManager.Get(LuisSlot.PARKING_YES, ClientMemoryManager.AS_STRING)
    var parkingNo = memoryManager.Get(LuisSlot.PARKING_NO, ClientMemoryManager.AS_STRING)
    var stars = memoryManager.Get(LuisSlot.STARS, ClientMemoryManager.AS_STRING)
    var type_ = memoryManager.Get(LuisSlot.TYPE, ClientMemoryManager.AS_STRING)

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
            memoryManager.Delete(LuisSlot.DAY)
        }
        if (people) {
            memoryManager.Delete(RestaurantSlot.PEOPLE)
            memoryManager.Set(RestaurantSlot.PEOPLE, people)
            memoryManager.Delete(LuisSlot.PEOPLE)
        }
        if (time) {
            memoryManager.Delete(RestaurantSlot.TIME)
            memoryManager.Set(RestaurantSlot.TIME, time)
            memoryManager.Delete(LuisSlot.TIME)
        }
        if (area) {
            memoryManager.Delete(RestaurantSlot.AREA)
            memoryManager.Set(RestaurantSlot.AREA, area)
            memoryManager.Delete(LuisSlot.AREA)
        }
        if (food) {
            memoryManager.Delete(RestaurantSlot.FOOD)
            memoryManager.Set(RestaurantSlot.FOOD, food)
            memoryManager.Delete(LuisSlot.FOOD)
        }
        if (name) {
            memoryManager.Delete(RestaurantSlot.NAME)
            memoryManager.Set(RestaurantSlot.NAME, name)
            memoryManager.Delete(LuisSlot.NAME)
        }
        if (price) {
            memoryManager.Delete(RestaurantSlot.PRICERANGE)
            memoryManager.Set(RestaurantSlot.PRICERANGE, price)
            memoryManager.Delete(LuisSlot.PRICE)
        }
        return
    }
    if (domainFilter === "train") {
        if (people) {
            memoryManager.Delete(TrainSlot.PEOPLE)
            memoryManager.Set(TrainSlot.PEOPLE, people)
            memoryManager.Delete(LuisSlot.PEOPLE)
        }
        if (arrive) {
            memoryManager.Delete(TrainSlot.ARRIVE_BY)
            memoryManager.Set(TrainSlot.ARRIVE_BY, arrive)
            memoryManager.Delete(LuisSlot.ARRIVE_BY)
        }
        if (day) {
            memoryManager.Delete(TrainSlot.DAY)
            memoryManager.Set(TrainSlot.DAY, day)
            memoryManager.Delete(LuisSlot.DAY)
        }
        if (depart) {
            memoryManager.Delete(TrainSlot.DEPART)
            memoryManager.Set(TrainSlot.DEPART, depart)
            memoryManager.Delete(LuisSlot.DEPART)
        }
        if (dest) {
            memoryManager.Delete(TrainSlot.DESTINATION)
            memoryManager.Set(TrainSlot.DESTINATION, dest)
            memoryManager.Delete(LuisSlot.DESTINATION)
        }
        if (leave) {
            memoryManager.Delete(TrainSlot.LEAVE_AT)
            memoryManager.Set(TrainSlot.LEAVE_AT, leave)
            memoryManager.Delete(LuisSlot.LEAVE_AT)
        }
        return
    }
    if (domainFilter === "hotel") {
        if (day) {
            memoryManager.Delete(HotelSlot.DAY)
            memoryManager.Set(HotelSlot.DAY, day)
            memoryManager.Delete(LuisSlot.DAY)
        }
        if (people) {
            memoryManager.Delete(HotelSlot.PEOPLE)
            memoryManager.Set(HotelSlot.PEOPLE, people)
            memoryManager.Delete(LuisSlot.PEOPLE)
        }
        if (stay) {
            memoryManager.Delete(HotelSlot.STAY)
            memoryManager.Set(HotelSlot.STAY, stay)
            memoryManager.Delete(LuisSlot.STAY)
        }
        if (area) {
            memoryManager.Delete(HotelSlot.AREA)
            memoryManager.Set(HotelSlot.AREA, area)
            memoryManager.Delete(LuisSlot.AREA)
        }
        if (internetYes) {
            memoryManager.Delete(HotelSlot.INTERNET)
            memoryManager.Set(HotelSlot.INTERNET, "yes")
            memoryManager.Delete(LuisSlot.INTERNET_YES)
        }
        if (internetNo) {
            memoryManager.Delete(HotelSlot.INTERNET)
            memoryManager.Set(HotelSlot.INTERNET, "no")
            memoryManager.Delete(LuisSlot.INTERNET_NO)
        }
        if (name) {
            memoryManager.Delete(HotelSlot.NAME)
            memoryManager.Set(HotelSlot.NAME, name)
            memoryManager.Delete(LuisSlot.NAME)
        }
        if (parkingYes) {
            memoryManager.Delete(HotelSlot.PARKING)
            memoryManager.Set(HotelSlot.PARKING, "yes")
            memoryManager.Delete(LuisSlot.PARKING_YES)
        }
        if (parkingNo) {
            memoryManager.Delete(HotelSlot.PARKING)
            memoryManager.Set(HotelSlot.PARKING, "no")
            memoryManager.Delete(LuisSlot.PARKING_NO)
        }
        if (price) {
            memoryManager.Delete(HotelSlot.PRICERANGE)
            memoryManager.Set(HotelSlot.PRICERANGE, price)
            memoryManager.Delete(LuisSlot.PRICE)
        }
        if (stars) {
            memoryManager.Delete(HotelSlot.STARS)
            memoryManager.Set(HotelSlot.STARS, stars)
            memoryManager.Delete(LuisSlot.STARS)
        }
        if (type_) {
            memoryManager.Delete(HotelSlot.TYPE)
            memoryManager.Set(HotelSlot.TYPE, type_)
            memoryManager.Delete(LuisSlot.TYPE)
        }
    }
    if (domainFilter === "taxi") {
        if (arrive) {
            memoryManager.Delete(TaxiSlot.ARRIVE_BY)
            memoryManager.Set(TaxiSlot.ARRIVE_BY, arrive)
            memoryManager.Delete(LuisSlot.ARRIVE_BY)
        }
        if (depart) {
            memoryManager.Delete(TaxiSlot.DEPART)
            memoryManager.Set(TaxiSlot.DEPART, depart)
            memoryManager.Delete(LuisSlot.DEPART)
        }
        if (dest) {
            memoryManager.Delete(TaxiSlot.DESTINATION)
            memoryManager.Set(TaxiSlot.DESTINATION, dest)
            memoryManager.Delete(LuisSlot.DESTINATION)
        }
        if (leave) {
            memoryManager.Delete(TaxiSlot.LEAVE_AT)
            memoryManager.Set(TaxiSlot.LEAVE_AT, leave)
            memoryManager.Delete(LuisSlot.LEAVE_AT)
        }
        return
    }
    if (domainFilter === "attraction") {
        if (area) {
            memoryManager.Delete(AttractionSlot.AREA)
            memoryManager.Set(AttractionSlot.AREA, area)
            memoryManager.Delete(LuisSlot.AREA)
        }
        if (name) {
            memoryManager.Delete(AttractionSlot.NAME)
            memoryManager.Set(AttractionSlot.NAME, name)
            memoryManager.Delete(LuisSlot.NAME)
        }
        if (type_) {
            memoryManager.Delete(AttractionSlot.TYPE)
            memoryManager.Set(AttractionSlot.TYPE, type_)
            memoryManager.Delete(LuisSlot.TYPE)
        }
        return
    }
}

const UpdateDB = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    if (domainFilter == "restaurant") {

        var restaurants = RestaurantOptions(memoryManager)

        // If I have a couple ouptions, set from search results
        if (restaurants.length <= 2) {
            if (!memoryManager.Get(RestaurantSlot.AREA, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(RestaurantSlot.AREA, [... new Set(restaurants.map(a => a.area))])
            }
            if (!memoryManager.Get(RestaurantSlot.FOOD, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(RestaurantSlot.FOOD, [... new Set(restaurants.map(a => a.food))])
            }
            if (!memoryManager.Get(RestaurantSlot.NAME, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(RestaurantSlot.NAME, [... new Set(restaurants.map(a => a.name))])
            }
            if (!memoryManager.Get(RestaurantSlot.PRICERANGE, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(RestaurantSlot.PRICERANGE, [... new Set(restaurants.map(a => a.pricerange))])
            }
            if (!memoryManager.Get(RestaurantSlot.PRICERANGE, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(RestaurantSlot.PRICERANGE, [... new Set(restaurants.map(a => a.pricerange))])
            }
        }
        memoryManager.Delete(RestaurantSlot.CHOICE_ONE)
        memoryManager.Delete(RestaurantSlot.CHOICE_TWO)
        memoryManager.Delete(RestaurantSlot.CHOICE_MANY)
        if (restaurants.length == 1) {
            memoryManager.Set(RestaurantSlot.CHOICE_ONE, true)
        }
        else if (restaurants.length == 2) {
            memoryManager.Set(RestaurantSlot.CHOICE_TWO, true)
        }
        else if (restaurants.length > 2) {
            memoryManager.Set(RestaurantSlot.CHOICE_MANY, true)
        }
    }
    if (domainFilter == "hotel") {

        var hotels = HotelOptions(memoryManager)

        // If I have a couple ouptions, set from search results
        if (hotels.length <= 2) {
            if (!memoryManager.Get(HotelSlot.AREA, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(HotelSlot.AREA, [... new Set(hotels.map(a => a.area))])
            }
            if (!memoryManager.Get(HotelSlot.NAME, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(HotelSlot.NAME, [... new Set(hotels.map(a => a.name))])
            }
            if (!memoryManager.Get(HotelSlot.PRICERANGE, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(HotelSlot.PRICERANGE, [... new Set(hotels.map(a => a.pricerange))])
            }
            if (!memoryManager.Get(HotelSlot.STARS, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(HotelSlot.STARS, [... new Set(hotels.map(a => a.stars))])
            }
            if (!memoryManager.Get(HotelSlot.TYPE, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(HotelSlot.TYPE, [... new Set(hotels.map(a => a._type))])
            }
        }
        memoryManager.Delete(HotelSlot.CHOICE_ONE)
        memoryManager.Delete(HotelSlot.CHOICE_TWO)
        memoryManager.Delete(HotelSlot.CHOICE_MANY)
        if (hotels.length == 1) {
            memoryManager.Set(HotelSlot.CHOICE_ONE, true)
        }
        else if (hotels.length == 2) {
            memoryManager.Set(HotelSlot.CHOICE_TWO, true)
        }
        else if (hotels.length > 2) {
            memoryManager.Set(HotelSlot.CHOICE_MANY, true)
        }
    }
    if (domainFilter == "attraction") {
        var attractions = AttractionOptions(memoryManager)

        // If I have a couple ouptions, set from search results
        if (attractions.length <= 2) {
            if (!memoryManager.Get(AttractionSlot.AREA, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(AttractionSlot.AREA, [... new Set(attractions.map(a => a.area))])
            }
            if (!memoryManager.Get(AttractionSlot.NAME, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(AttractionSlot.NAME, [... new Set(attractions.map(a => a.name))])
            }
            if (!memoryManager.Get(AttractionSlot.TYPE, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(AttractionSlot.TYPE, [... new Set(attractions.map(a => a._type))])
            }
        }

        memoryManager.Delete(AttractionSlot.CHOICE_ONE)
        memoryManager.Delete(AttractionSlot.CHOICE_TWO)
        memoryManager.Delete(AttractionSlot.CHOICE_MANY)
        if (attractions.length == 1) {
            memoryManager.Set(AttractionSlot.CHOICE_ONE, true)
        }
        else if (attractions.length == 2) {
            memoryManager.Set(AttractionSlot.CHOICE_TWO, true)
        }
        else if (attractions.length > 2) {
            memoryManager.Set(AttractionSlot.CHOICE_MANY, true)
        }
    }
    if (domainFilter == "taxi") {
        var taxis = TaxiOptions(memoryManager)
        taxis.length
        // There's always a taxi
        memoryManager.Set(TaxiSlot.CHOICE_ONE, true)
    }
    if (domainFilter == "train") {
        var trains = TrainOptions(memoryManager)

        // If I have a couple ouptions, set from search results
        if (trains.length <= 2) {
            if (!memoryManager.Get(TrainSlot.DAY, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(TrainSlot.DAY, [... new Set(trains.map(a => a.day))])
            }
            if (!memoryManager.Get(TrainSlot.DEPART, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(TrainSlot.DEPART, [... new Set(trains.map(a => a.departure))])
            }
            if (!memoryManager.Get(TrainSlot.DESTINATION, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(TrainSlot.DESTINATION, [... new Set(trains.map(a => a.destination))])
            }
            if (!memoryManager.Get(TrainSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(TrainSlot.LEAVE_AT, [... new Set(trains.map(a => a.leaveAt))])
            }
            if (!memoryManager.Get(TrainSlot.ARRIVE_BY, ClientMemoryManager.AS_STRING)) {
                memoryManager.Set(TrainSlot.ARRIVE_BY, [... new Set(trains.map(a => a.arriveBy))])
            }
        }
        memoryManager.Delete(TrainSlot.CHOICE_ONE)
        memoryManager.Delete(TrainSlot.CHOICE_TWO)
        memoryManager.Delete(TrainSlot.CHOICE_MANY)
        if (trains.length == 1) {
            memoryManager.Set(TrainSlot.CHOICE_ONE, true)
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

    var trains = TrainOptions(memoryManager)
    if (trains.length == 1) {
        entities.push(`train-id: ${trains[0].trainID}`)
        entities.push(`train-ticket: ${trains[0].price}`)
        entities.push(`train-duration: ${trains[0].duration}`)
    }

    Object.values(TrainSlot).map((entityName: string) => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
        else if (trains.length == 1) {
            var key = Utils.propertyName(entityName) as keyof Train
            entities.push(`${entityName}: ${trains[0][key]}`)
        }
    })
    return entities
}

const restaurantEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    var restaurants = RestaurantOptions(memoryManager)
    if (restaurants.length == 1) {
        entities.push(`restaurant-address: ${restaurants[0].address}`)
        entities.push(`restaurant-phone: ${restaurants[0].phone}`)
        entities.push(`restaurant-postcode: ${restaurants[0].postcode}`)
        entities.push(`restaurant-ref: ${Utils.makeId(8)}`)
    }

    Object.values(RestaurantSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
        else if (restaurants.length == 1) {
            var key = Utils.propertyName(entityName) as keyof Restaurant
            entities.push(`${entityName}: ${restaurants[0][key]}`)
        }
    })
    return entities
}

const hotelEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    var hotels = HotelOptions(memoryManager)
    if (hotels.length == 1) {
        entities.push(`hotel-address: ${hotels[0].address}`)
        entities.push(`hotel-phone: ${hotels[0].phone}`)
        entities.push(`hotel-postcode: ${hotels[0].postcode}`)
        entities.push(`hotel-ref: ${Utils.makeId(8)}`)
    }

    Object.values(HotelSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
        else if (hotels.length == 1) {
            var key = Utils.propertyName(entityName) as keyof Hotel
            entities.push(`${entityName}: ${hotels[0][key]}`)
        }
    })

    return entities
}

const attractionEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []

    var attractions = AttractionOptions(memoryManager)
    if (attractions.length == 1) {
        entities.push(`attraction-address: ${attractions[0].address}`)
        entities.push(`attraction-phone: ${attractions[0].phone}`)
        entities.push(`attraction-postcode: ${attractions[0].postcode}`)
        entities.push(`attraction-fee: ${attractions[0].entrancefee}`)
        entities.push(`attraction-pricerange: ${attractions[0].pricerange}`)
    }

    Object.values(AttractionSlot).map(entityName => {
        var values = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (values) {
            entities.push(`${entityName}: ${values}`)
        }
        else if (attractions.length == 1) {
            var key = Utils.propertyName(entityName) as keyof Attraction
            entities.push(`${entityName}: ${attractions[0][key]}`)
        }
    })
    return entities
}

const taxiEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(TaxiSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
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

export interface TestResult {
    input: string
    expected: string
    actual: string
    error?: string
}

export interface ActivityResult {
    // Used to match import utterances
    activityId: string
    domainResults: Map<Domain, DomainResult | null>
    creationTime?: number
}

var RestaurantOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Restaurant[] => {

    var area = Utils.MemoryValues(RestaurantSlot.AREA, memoryManager)
    var food = Utils.MemoryValues(RestaurantSlot.FOOD, memoryManager)
    var name = Utils.MemoryValues(RestaurantSlot.NAME, memoryManager)
    var pricerange = Utils.MemoryValues(RestaurantSlot.PRICERANGE, memoryManager)

    var restaurants = RestaurantDb()
    if (area.length > 0) {
        restaurants = restaurants.filter(r => area.includes(Utils.BaseString(r.area)))
    }
    if (food.length > 0) {
        restaurants = restaurants.filter(r => food.includes(Utils.BaseString(r.food)))
    }
    if (name.length > 0) {
        restaurants = restaurants.filter(r => name.includes(Utils.BaseString(r.name)))
    }
    if (pricerange.length > 0) {
        restaurants = restaurants.filter(r => pricerange.includes(Utils.BaseString(r.pricerange)))
    }
    return restaurants
}

var AttractionOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Attraction[] => {

    var area = Utils.MemoryValues(AttractionSlot.AREA, memoryManager)
    var name = Utils.MemoryValues(AttractionSlot.NAME, memoryManager)
    var _type = Utils.MemoryValues(AttractionSlot.TYPE, memoryManager)

    //TODO entracneFree / price /etc no semantics ??

    var attraction = AttractionDb()
    if (area.length > 0) {
        attraction = attraction.filter(r => area.includes(Utils.BaseString(r.area)))
    }
    if (name.length > 0) {
        attraction = attraction.filter(r => name.includes(Utils.BaseString(r.name)))
    }
    if (_type.length > 0) {
        attraction = attraction.filter(r => _type.includes(Utils.BaseString(r._type)))
    }
    return attraction
}
var HotelOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Hotel[] => {

    var area = Utils.MemoryValues(HotelSlot.AREA, memoryManager)
    var internet = Utils.MemoryValues(HotelSlot.INTERNET, memoryManager)
    var parking = Utils.MemoryValues(HotelSlot.PARKING, memoryManager)
    var name = Utils.MemoryValues(HotelSlot.NAME, memoryManager)
    var pricerange = Utils.MemoryValues(HotelSlot.PRICERANGE, memoryManager)
    var stars = Utils.MemoryValues(HotelSlot.STARS, memoryManager)
    var _type = Utils.MemoryValues(HotelSlot.TYPE, memoryManager)

    //TODO takesbookings ??

    var hotels = HotelDb()
    if (area.length > 0) {
        hotels = hotels.filter(r => area.includes(Utils.BaseString(r.area)))
    }
    if (internet.includes("yes")) {
        hotels = hotels.filter(r => r.internet === "yes")
    }
    if (parking.includes("yes")) {
        hotels = hotels.filter(r => r.parking === "yes")
    }
    if (name.length > 0) {
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
    return hotels
}

var TrainOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Train[] => {

    var arriveBy = Utils.MemoryValues(TrainSlot.ARRIVE_BY, memoryManager)
    var day = Utils.MemoryValues(TrainSlot.DAY, memoryManager)
    var departure = Utils.MemoryValues(TrainSlot.DEPART, memoryManager)
    var destination = Utils.MemoryValues(TrainSlot.DESTINATION, memoryManager)
    var leaveAt = Utils.MemoryValues(TrainSlot.LEAVE_AT, memoryManager)

    //TODO entracneFree / price /etc no semantics ??

    var trains = TrainDb()
    if (day.length > 0) {
        trains = trains.filter(r => day.includes(Utils.BaseString(r.day)))
    }
    if (departure.length > 0) {
        trains = trains.filter(r => departure.includes(Utils.BaseString(r.departure)))
    }
    if (destination.length > 0) {
        trains = trains.filter(r => destination.includes(Utils.BaseString(r.destination)))
    }
    // Don't filter on times until I have a route and day
    if (departure.length > 0 && destination.length > 0 && day.length > 0) {
        if (leaveAt.length > 0 && !isNaN(Utils.parseTime(leaveAt[0]))) {
            const bestTrain = Utils.trainLeaveAfter(trains, leaveAt[0])
            trains = bestTrain ? [bestTrain] : []
        }
        if (arriveBy.length > 0 && !isNaN(Utils.parseTime(arriveBy[0]))) {
            const bestTrain = Utils.trainArriveBefore(trains, arriveBy[0])
            trains = bestTrain ? [bestTrain] : []
        }
    }
    return trains
}

var TaxiOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Taxi[] => {
    return TaxiDb()
}

var _restaurantDb: Restaurant[] = []
var _attractionDb: Attraction[] = []
var _hotelDb: Hotel[] = []
var _taxiDb: Taxi[] = []
var _trainDb: Train[] = []
var _entitySubstitutions: { [key: string]: string }
var _dialogActs: string[]

var RestaurantDb = (): Restaurant[] => {
    if (_restaurantDb.length == 0) {
        _restaurantDb = LoadDataBase("restaurant_db")
    }
    return _restaurantDb
}
var AttractionDb = (): Attraction[] => {
    if (_attractionDb.length == 0) {
        _attractionDb = LoadDataBase("attraction_db")
    }
    return _attractionDb
}
var HotelDb = (): Hotel[] => {
    if (_hotelDb.length == 0) {
        _hotelDb = LoadDataBase("hotel_db")
    }
    return _hotelDb
}
export var TaxiDb = (): Taxi[] => {
    if (_taxiDb.length == 0) {
        _taxiDb = LoadDataBase("taxi_db")
    }
    return _taxiDb
}
var TrainDb = (): Train[] => {
    if (_trainDb.length == 0) {
        _trainDb = LoadDataBase("train_db")
    }
    return _trainDb
}

export var EntitySubstitutions = (): { [key: string]: string } => {
    if (!_entitySubstitutions) {
        _entitySubstitutions = LoadDataBase("entity_substitutions")
    }
    return _entitySubstitutions
}

export var DialogActs = (): string[] => {
    if (!_dialogActs) {
        _dialogActs = LoadDataBase("dialog_acts")
    }
    return _dialogActs
}

var LoadDataBase = (databaseName: string): any => {
    const filename = path.join(GetDirectory(DBDirectory), `${databaseName}.json`)
    const templateString = fs.readFileSync(filename, 'utf-8')
    const template = JSON.parse(templateString.split('"type":').join('"_type":'))
    return template
}

