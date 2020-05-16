/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as path from 'path'
import * as express from 'express'
import * as BB from 'botbuilder'
import { ConversationLearner, ConversationLearnerFactory, ClientMemoryManager, ReadOnlyClientMemoryManager, FileStorage, uiRouter } from '@conversationlearner/sdk'
import chalk from 'chalk'
import config from './config'
import { Restaurant, Hotel, Attraction, Taxi, Train, RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, LuisSlot, Domain, DONTCARE, OUTPUT, NameSubstitutionMap } from './dataTypes'
import * as fs from 'fs'
import * as crypto from 'crypto'

console.log(`Config:\n`, JSON.stringify(config, null, '  '))

//===================
// Create Bot server
//===================
const server = express()

const { bfAppId, bfAppPassword, modelId, ...clOptions } = config

//==================
// Create Adapter
//==================
const adapter = new BB.BotFrameworkAdapter({ appId: bfAppId, appPassword: bfAppPassword })

//==================================
// Storage
//==================================
const fileStorage = new FileStorage(path.join(__dirname, 'storage'))

//==================================
// Initialize Conversation Learner
//==================================
const clFactory = new ConversationLearnerFactory(clOptions, fileStorage)

const includeSdk = ['development', 'test'].includes(process.env.NODE_ENV ?? '')
if (includeSdk) {
    console.log(chalk.cyanBright(`Adding /sdk routes`))
    server.use('/sdk', clFactory.sdkRouter)

    // Note: Must be mounted at root to use internal /ui paths
    console.log(chalk.greenBright(`Adding /ui routes`))
    server.use(uiRouter as any)
}

// Serve default bot summary page. Should be customized by customer.
server.use(express.static(path.join(__dirname, '..', 'site')))


export interface ActivityResult {
    // Used to match import utterances
    activityId: string
    domainResults: Map<Domain, DomainResult | null>
    creationTime?: number
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

let ActivityResults: ActivityResult[] = []
let TestOutput = new Map<string, string>()

//=================================
// Add Entity Logic
//=================================
const UpdateEntities = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    UpdateDomain(memoryManager, domainFilter)
    UpdateDB(memoryManager, domainFilter)
}

// Apply substitutions (i.e. "0-star" = "0")
const ApplyEntitySubstitutions = (memoryManager: ClientMemoryManager): void => {
    Object.values(LuisSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
        if (value) {
            var substitution = EntitySubstitutions()[value]
            if (substitution) {
                memoryManager.Set(entityName, substitution)
                return substitution
            }
        }
    })
}

const ExpandTime = (time: string, addHours: number = 0): string => {
    var parts = time.split(":")
    var hour = +parts[0] + addHours
    var min = parts[1] ? parts[1] : "00"
    return `${hour}:${min}`
}
const ProcessTime = (time: string): string => {
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
        time = ProcessTime(time)
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
const getEntities = (domain: Domain, memoryManager: ClientMemoryManager) => {
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
            var key = propertyName(entityName) as keyof Train
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
        entities.push(`restaurant-ref: ${makeId(8)}`)
    }

    Object.values(RestaurantSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
        else if (restaurants.length == 1) {
            var key = propertyName(entityName) as keyof Restaurant
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
        entities.push(`hotel-ref: ${makeId(8)}`)
    }

    Object.values(HotelSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING_LIST)
        if (value) {
            entities.push(`${entityName}: ${value}`)
        }
        else if (hotels.length == 1) {
            var key = propertyName(entityName) as keyof Hotel
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
            var key = propertyName(entityName) as keyof Attraction
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

//=================================
// Output
//=================================
const apiAddOutput = {
    name: "AddOutput",
    logic: async (memoryManager: ClientMemoryManager, intent: string) => {
        memoryManager.Set(OUTPUT, intent)
    }
}

//=================================
// dontcare
//=================================
const apiDontCareArea = {
    name: "dontcare-area",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.AREA, DONTCARE)
        UpdateEntities(memoryManager)
    }
}

const apiDontCarePrice = {
    name: "dontcare-price",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.PRICE, DONTCARE)
        UpdateEntities(memoryManager)
    }
}

const apiDontCareFood = {
    name: "dontcare-food",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.FOOD, DONTCARE)
        UpdateEntities(memoryManager)
    }
}

const apiDontCareArrive = {
    name: "dontcare-arrive",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.ARRIVE_BY, DONTCARE)
        UpdateEntities(memoryManager)
    }
}

const apiDontCareType = {
    name: "dontcare-type",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.TYPE, DONTCARE)
        UpdateEntities(memoryManager)
    }
}

const apiDontCareName = {
    name: "dontcare-name",
    logic: async (memoryManager: ClientMemoryManager) => {
        memoryManager.Set(LuisSlot.NAME, DONTCARE)
        UpdateEntities(memoryManager)
    }
}

//=================================
// Directories
//=================================
const DBDirectory = 'mwdb'
const TestDirectory = 'testtranscripts'
const ResultsDirectory = 'testresults'
let GetDirectory = (name: string) => {
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

//=================================
// Options
//=================================
// Return version of string with no puncuation or space and lowercase
var BaseString = (text: string): string => {
    return text.replace(/[^\w\s]|_/g, "").replace(/\s/g, "").toLowerCase()
}

var MemoryValues = (slot: any, memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): string[] => {
    return memoryManager.Get(slot, ClientMemoryManager.AS_STRING_LIST)
        .map(i => BaseString(i))
        .filter(i => i != "none" && i != "dontcare")
}

var trainArriveBefore = (trains: Train[], arriveBefore: string): Train | null => {

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

var trainLeaveAfter = (trains: Train[], leaveAfter: string): Train | null => {

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

var parseTime = (time: string): number => {
    var parts = time.split(":")
    return (parseInt(parts[0]) * 60) + parseInt(parts[1])
}

var RestaurantOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Restaurant[] => {

    var area = MemoryValues(RestaurantSlot.AREA, memoryManager)
    var food = MemoryValues(RestaurantSlot.FOOD, memoryManager)
    var name = MemoryValues(RestaurantSlot.NAME, memoryManager)
    var pricerange = MemoryValues(RestaurantSlot.PRICERANGE, memoryManager)

    var restaurants = RestaurantDb()
    if (area.length > 0) {
        restaurants = restaurants.filter(r => area.includes(BaseString(r.area)))
    }
    if (food.length > 0) {
        restaurants = restaurants.filter(r => food.includes(BaseString(r.food)))
    }
    if (name.length > 0) {
        restaurants = restaurants.filter(r => name.includes(BaseString(r.name)))
    }
    if (pricerange.length > 0) {
        restaurants = restaurants.filter(r => pricerange.includes(BaseString(r.pricerange)))
    }
    return restaurants
}

var AttractionOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Attraction[] => {

    var area = MemoryValues(AttractionSlot.AREA, memoryManager)
    var name = MemoryValues(AttractionSlot.NAME, memoryManager)
    var _type = MemoryValues(AttractionSlot.TYPE, memoryManager)

    //TODO entracneFree / price /etc no semantics ??

    var attraction = AttractionDb()
    if (area.length > 0) {
        attraction = attraction.filter(r => area.includes(BaseString(r.area)))
    }
    if (name.length > 0) {
        attraction = attraction.filter(r => name.includes(BaseString(r.name)))
    }
    if (_type.length > 0) {
        attraction = attraction.filter(r => _type.includes(BaseString(r._type)))
    }
    return attraction
}

var HotelOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Hotel[] => {

    var area = MemoryValues(HotelSlot.AREA, memoryManager)
    var internet = MemoryValues(HotelSlot.INTERNET, memoryManager)
    var parking = MemoryValues(HotelSlot.PARKING, memoryManager)
    var name = MemoryValues(HotelSlot.NAME, memoryManager)
    var pricerange = MemoryValues(HotelSlot.PRICERANGE, memoryManager)
    var stars = MemoryValues(HotelSlot.STARS, memoryManager)
    var _type = MemoryValues(HotelSlot.TYPE, memoryManager)

    //TODO takesbookings ??

    var hotels = HotelDb()
    if (area.length > 0) {
        hotels = hotels.filter(r => area.includes(BaseString(r.area)))
    }
    if (internet.includes("yes")) {
        hotels = hotels.filter(r => r.internet === "yes")
    }
    if (parking.includes("yes")) {
        hotels = hotels.filter(r => r.parking === "yes")
    }
    if (name.length > 0) {
        hotels = hotels.filter(r => name.includes(BaseString(r.name)))
    }
    if (pricerange.length > 0) {
        hotels = hotels.filter(r => pricerange.includes(BaseString(r.pricerange)))
    }
    if (stars.length > 0) {
        hotels = hotels.filter(r => stars.includes(BaseString(r.stars)))
    }
    if (_type.length > 0) {
        hotels = hotels.filter(r => _type.includes(BaseString(r._type)))
    }
    return hotels
}

var TrainOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Train[] => {

    var arriveBy = MemoryValues(TrainSlot.ARRIVE_BY, memoryManager)
    var day = MemoryValues(TrainSlot.DAY, memoryManager)
    var departure = MemoryValues(TrainSlot.DEPART, memoryManager)
    var destination = MemoryValues(TrainSlot.DESTINATION, memoryManager)
    var leaveAt = MemoryValues(TrainSlot.LEAVE_AT, memoryManager)

    //TODO entracneFree / price /etc no semantics ??

    var trains = TrainDb()
    if (day.length > 0) {
        trains = trains.filter(r => day.includes(BaseString(r.day)))
    }
    if (departure.length > 0) {
        trains = trains.filter(r => departure.includes(BaseString(r.departure)))
    }
    if (destination.length > 0) {
        trains = trains.filter(r => destination.includes(BaseString(r.destination)))
    }
    // Don't filter on times until I have a route and day
    if (departure.length > 0 && destination.length > 0 && day.length > 0) {
        if (leaveAt.length > 0 && !isNaN(parseTime(leaveAt[0]))) {
            const bestTrain = trainLeaveAfter(trains, leaveAt[0])
            trains = bestTrain ? [bestTrain] : []
        }
        if (arriveBy.length > 0 && !isNaN(parseTime(arriveBy[0]))) {
            const bestTrain = trainArriveBefore(trains, arriveBy[0])
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
var TaxiDb = (): Taxi[] => {
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

var EntitySubstitutions = (): { [key: string]: string } => {
    if (!_entitySubstitutions) {
        _entitySubstitutions = LoadDataBase("entity_substitutions")
    }
    return _entitySubstitutions
}

var LoadDataBase = (databaseName: string): any => {
    const filename = path.join(GetDirectory(DBDirectory), `${databaseName}.json`)
    const templateString = fs.readFileSync(filename, 'utf-8')
    const template = JSON.parse(templateString.split('"type":').join('"_type":'))
    return template
}

//=================================
// Initialize Models
//=================================
let clCombined: ConversationLearner
const initCombinedModel = () => {
    const modelId = ConversationLearnerFactory.modelIdFromName("combined")
    clCombined = clFactory.create(modelId)

    clCombined.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
        ApplyEntitySubstitutions(memoryManager)
        UpdateEntities(memoryManager)
    }

    clCombined.AddCallback(apiAddOutput)

    clCombined.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager) => {
            var output = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            memoryManager.Delete(OUTPUT)
            return output
        },
        render: async (intents: any, memoryManager: ReadOnlyClientMemoryManager) => {
            var entities: string[] = []
            /*
            if (memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)) {
                entities = [...entities, ...trainEntities(memoryManager)]
            }
            if (memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)) {
                entities = [...entities, ...restaurantEntities(memoryManager)]
            }

            if (memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)) {
                entities = [...entities, ...hotelEntities(memoryManager)]
            }

            if (memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)) {
                entities = [...entities, ...attractionEntities(memoryManager)]
            }

            if (memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)) {
                entities = [...entities, ...taxiEntities(memoryManager)]
            }
            */
            return `${intents.join(", ")} {${entities.join(", ")}}`
        }
    })

    //=== SetDomain Callbacks ===
    clCombined.AddCallback<number>({
        name: "SetDomain-train",
        logic: async (memoryManager) => {
            memoryManager.Delete(Domain.HOTEL)
            memoryManager.Delete(Domain.RESTAURANT)
            memoryManager.Delete(Domain.TAXI)
            memoryManager.Delete(Domain.ATTRACTION)

            memoryManager.Set(Domain.TRAIN, Domain.TRAIN)
            UpdateEntities(memoryManager)
        }
    })
    clCombined.AddCallback<number>({
        name: "SetDomain-hotel",
        logic: async (memoryManager) => {
            memoryManager.Delete(Domain.TRAIN)
            memoryManager.Delete(Domain.RESTAURANT)
            memoryManager.Delete(Domain.TAXI)
            memoryManager.Delete(Domain.ATTRACTION)

            memoryManager.Set(Domain.HOTEL, Domain.HOTEL)
            UpdateEntities(memoryManager)
        }
    })
    clCombined.AddCallback<number>({
        name: "SetDomain-restaurant",
        logic: async (memoryManager) => {
            memoryManager.Delete(Domain.TRAIN)
            memoryManager.Delete(Domain.HOTEL)
            memoryManager.Delete(Domain.TAXI)
            memoryManager.Delete(Domain.ATTRACTION)

            memoryManager.Set(Domain.RESTAURANT, Domain.RESTAURANT)
            UpdateEntities(memoryManager)
        }
    })
    clCombined.AddCallback<number>({
        name: "SetDomain-taxi",
        logic: async (memoryManager) => {
            memoryManager.Delete(Domain.TRAIN)
            memoryManager.Delete(Domain.HOTEL)
            memoryManager.Delete(Domain.RESTAURANT)
            memoryManager.Delete(Domain.ATTRACTION)

            memoryManager.Set(Domain.TAXI, Domain.TAXI)
            UpdateEntities(memoryManager)
        }
    })
    clCombined.AddCallback<number>({
        name: "SetDomain-attraction",
        logic: async (memoryManager) => {
            memoryManager.Delete(Domain.TRAIN)
            memoryManager.Delete(Domain.HOTEL)
            memoryManager.Delete(Domain.RESTAURANT)
            memoryManager.Delete(Domain.TAXI)

            memoryManager.Set(Domain.ATTRACTION, Domain.ATTRACTION)
            UpdateEntities(memoryManager)
        }
    })

    //=== Same Callbacks ===
    clCombined.AddCallback<number>({
        name: "same-price",
        logic: async (memoryManager) => {

            var rprice = memoryManager.Get(RestaurantSlot.PRICERANGE, ClientMemoryManager.AS_STRING)
            var hprice = memoryManager.Get(HotelSlot.PRICERANGE, ClientMemoryManager.AS_STRING)

            var restaurant = memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)
            if (restaurant !== null && restaurant !== undefined && (hprice)) {
                memoryManager.Set(RestaurantSlot.PRICERANGE, hprice as string)
                return
            }

            var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
            if (hotel !== null && hotel !== undefined && (rprice)) {
                memoryManager.Set(HotelSlot.PRICERANGE, rprice as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-arrive",
        logic: async (memoryManager) => {

            var tarrive = memoryManager.Get(TrainSlot.ARRIVE_BY, ClientMemoryManager.AS_STRING)
            var xarrive = memoryManager.Get(TaxiSlot.ARRIVE_BY, ClientMemoryManager.AS_STRING)

            var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
            if (train !== null && train !== undefined && (xarrive)) {
                memoryManager.Set(TrainSlot.ARRIVE_BY, xarrive as string)
                return
            }

            var taxi = memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)
            if (taxi !== null && taxi !== undefined && (tarrive)) {
                memoryManager.Set(TaxiSlot.ARRIVE_BY, tarrive as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-depart",
        logic: async (memoryManager) => {

            var tdepart = memoryManager.Get(TrainSlot.DEPART, ClientMemoryManager.AS_STRING)
            var xdepart = memoryManager.Get(TaxiSlot.DEPART, ClientMemoryManager.AS_STRING)

            var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
            if (train !== null && train !== undefined && (xdepart)) {
                memoryManager.Set(TrainSlot.DEPART, xdepart as string)
                return
            }

            var taxi = memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)
            if (taxi !== null && taxi !== undefined && (tdepart)) {
                memoryManager.Set(TaxiSlot.DEPART, tdepart as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-dest",
        logic: async (memoryManager) => {

            var tdest = memoryManager.Get(TrainSlot.DESTINATION, ClientMemoryManager.AS_STRING)
            var xdest = memoryManager.Get(TaxiSlot.DESTINATION, ClientMemoryManager.AS_STRING)

            var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
            if (train !== null && train !== undefined && (xdest)) {
                memoryManager.Set(TrainSlot.DESTINATION, xdest as string)
                return
            }

            var taxi = memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)
            if (taxi !== null && taxi !== undefined && (tdest)) {
                memoryManager.Set(TaxiSlot.DESTINATION, tdest as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-leave",
        logic: async (memoryManager) => {

            var tleave = memoryManager.Get(TrainSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)
            var xleave = memoryManager.Get(TaxiSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)

            var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
            if (train !== null && train !== undefined && (xleave)) {
                memoryManager.Set(TrainSlot.LEAVE_AT, xleave as string)
                return
            }

            var taxi = memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)
            if (taxi !== null && taxi !== undefined && (tleave)) {
                memoryManager.Set(TaxiSlot.LEAVE_AT, tleave as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-name",
        logic: async (memoryManager) => {

            var rname = memoryManager.Get(RestaurantSlot.NAME, ClientMemoryManager.AS_STRING)
            var hname = memoryManager.Get(HotelSlot.NAME, ClientMemoryManager.AS_STRING)
            var aname = memoryManager.Get(AttractionSlot.NAME, ClientMemoryManager.AS_STRING)

            var restaurant = memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)
            if (restaurant !== null && restaurant !== undefined && (hname || aname)) {
                memoryManager.Set(RestaurantSlot.NAME, hname || aname as string)
                return
            }

            var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
            if (hotel !== null && hotel !== undefined && (aname || rname)) {
                memoryManager.Set(HotelSlot.NAME, aname || rname as string)
                return
            }

            var attraction = memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)
            if (attraction !== null && attraction !== undefined && (rname || hname)) {
                memoryManager.Set(AttractionSlot.NAME, rname || hname as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-type",
        logic: async (memoryManager) => {

            var htype = memoryManager.Get(HotelSlot.TYPE, ClientMemoryManager.AS_STRING)
            var atype = memoryManager.Get(AttractionSlot.TYPE, ClientMemoryManager.AS_STRING)

            var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
            if (hotel !== null && hotel !== undefined && (atype)) {
                memoryManager.Set(HotelSlot.TYPE, atype as string)
                return
            }

            var attraction = memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)
            if (attraction !== null && attraction !== undefined && (htype)) {
                memoryManager.Set(AttractionSlot.TYPE, htype as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-people",
        logic: async (memoryManager) => {

            var rpeople = memoryManager.Get(RestaurantSlot.PEOPLE, ClientMemoryManager.AS_STRING)
            var tpeople = memoryManager.Get(TrainSlot.PEOPLE, ClientMemoryManager.AS_STRING)
            var hpeople = memoryManager.Get(HotelSlot.PEOPLE, ClientMemoryManager.AS_STRING)

            var restaurant = memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)
            if (restaurant !== null && restaurant !== undefined && (tpeople || hpeople)) {
                memoryManager.Set(RestaurantSlot.PEOPLE, tpeople || hpeople as string)
                return
            }

            var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
            if (train !== null && train !== undefined && (rpeople || hpeople)) {
                memoryManager.Set(TrainSlot.PEOPLE, rpeople || hpeople as string)
                return
            }

            var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
            if (hotel !== null && hotel !== undefined && (rpeople || tpeople)) {
                memoryManager.Set(HotelSlot.PEOPLE, rpeople || tpeople as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-area",
        logic: async (memoryManager) => {

            var rarea = memoryManager.Get(RestaurantSlot.AREA, ClientMemoryManager.AS_STRING)
            var aarea = memoryManager.Get(AttractionSlot.AREA, ClientMemoryManager.AS_STRING)
            var harea = memoryManager.Get(HotelSlot.AREA, ClientMemoryManager.AS_STRING)

            var restaurant = memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)
            if (restaurant !== null && restaurant !== undefined && (aarea || harea)) {
                memoryManager.Set(RestaurantSlot.AREA, aarea || harea as string)
                return
            }

            var attraction = memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)
            if (attraction !== null && attraction !== undefined && (rarea || harea)) {
                memoryManager.Set(AttractionSlot.AREA, rarea || harea as string)
                return
            }

            var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
            if (hotel !== null && hotel !== undefined && (rarea || aarea)) {
                memoryManager.Set(HotelSlot.AREA, rarea || aarea as string)
                return
            }
        }
    })
    clCombined.AddCallback<number>({
        name: "same-day",
        logic: async (memoryManager) => {

            var tday = memoryManager.Get(TrainSlot.DAY, ClientMemoryManager.AS_STRING)
            var hday = memoryManager.Get(HotelSlot.DAY, ClientMemoryManager.AS_STRING)
            var rday = memoryManager.Get(RestaurantSlot.DAY, ClientMemoryManager.AS_STRING)

            var restaurant = memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)
            if (restaurant !== null && restaurant !== undefined && (tday || hday)) {
                memoryManager.Set(RestaurantSlot.DAY, tday || hday as string)
                return
            }

            var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
            if (train !== null && train !== undefined && (rday || hday)) {
                memoryManager.Set(TrainSlot.DAY, rday || hday as string)
                return
            }

            var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
            if (hotel !== null && hotel !== undefined && (rday || tday)) {
                memoryManager.Set(HotelSlot.DAY, rday || tday as string)
                return
            }
        }
    })

    //=== DontCare Callbacks ===
    clCombined.AddCallback(apiDontCareArea)
    clCombined.AddCallback(apiDontCarePrice)
    clCombined.AddCallback(apiDontCareFood)
    clCombined.AddCallback(apiDontCareArrive)
    clCombined.AddCallback(apiDontCareType)
}

let clDispatch: ConversationLearner
const initDispatchModel = () => {

    const modelId = ConversationLearnerFactory.modelIdFromName("dispatch")
    clDispatch = clFactory.create(modelId)

    clDispatch.AddCallback({
        name: "Dispatch",
        logic: async (memoryManager: ClientMemoryManager, activityId: string, domainString: string) => {

            var domain = domainString as Domain
            var result = ActivityResults.find(r => r.activityId === activityId)
            if (!result) {
                result = {
                    activityId,
                    creationTime: new Date().getTime(),
                    domainResults: new Map<Domain, DomainResult>()
                }
                ActivityResults.push(result)
            }
            // Add empty entry for this domain
            result.domainResults.set(domain, null)
        }
    })

    clDispatch.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId) => {
            const activityResult = await getActivityResult(activityId)
            const result = ActivityResultToString(activityResult)
            TestOutput.set(activityId, result)
            return result
        },
        render: async (activityResult: string, memoryManager: ReadOnlyClientMemoryManager, ...args: string[]) => {
            return activityResult
        }
    })
}

const ActivityResultToString = (activityResult: ActivityResult): string => {
    let dialogActs: string[] = []
    let entities: string[] = []
    let output: string[][] = []
    activityResult.domainResults.forEach(dr => {
        if (dr) {
            dialogActs = [...dialogActs, ...dr.dialogActs]
            entities = [...entities, ...dr.entities]
            output = output.concat(dr.output)
        }
    })
    //return `${dialogActs.join(",")} ${entities.join(",")}`
    return JSON.stringify(output)
}

const makeId = (length: number): string => {
    var result = ''
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    var charactersLength = characters.length
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

const expandedResults = (dialogActs: string[], entities: string[]): string[][] => {
    const results: string[][] = []
    for (var dialogAct of dialogActs) {
        var parts = dialogAct.split('-')
        const domain = parts[0]
        const act = parts[1]
        const entity = parts[2]

        if (act == "Request") {
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
const getDomainCL = (domain: Domain): ConversationLearner => {

    const modelId = ConversationLearnerFactory.modelIdFromName(domain)
    const model = clFactory.create(modelId)

    var slotNames = getSlotNames(domain)
    const slotMap = new Map()
    slotNames.forEach((entityName: string) => {
        return slotMap.set(shortName(entityName), entityName)
    })

    model.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
        ApplyEntitySubstitutions(memoryManager)
        UpdateEntities(memoryManager, domain)
    }

    model.AddCallback(apiAddOutput)

    model.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId: string) => {

            const activityResult = ActivityResults.find(ar => ar.activityId === activityId)
            if (!activityId) {
                throw new Error(`Missing Activity ${activityId}`)
            }
            if (!activityResult?.domainResults.has(domain)) {
                throw new Error(`Expected Domain ${domain}`)
            }
            const dialogActs = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            const entities = getEntities(domain, memoryManager)
            const output = expandedResults(dialogActs, entities)

            const result: DomainResult = {
                dialogActs,
                entities,
                output
            }
            activityResult.domainResults.set(domain, result)
            memoryManager.Delete(OUTPUT)
            return
        }
    })

    //=== "Same" Callbacks ===
    Object.values(LuisSlot).forEach(entityName => {
        var slotName = slotMap.get(entityName)
        if (slotName) {
            model.AddCallback({
                name: `same-${entityName}`,
                logic: async (memoryManager) => {
                    var price = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
                    if (slotName) {
                        memoryManager.Set(slotName, price as string)
                    }
                }
            })
        }
    })

    //=== DontCare Callbacks ===
    model.AddCallback(apiDontCareArea)
    model.AddCallback(apiDontCarePrice)
    model.AddCallback(apiDontCareFood)
    model.AddCallback(apiDontCareArrive)
    model.AddCallback(apiDontCareType)
    model.AddCallback(apiDontCareName)

    return model
}

const shortName = (entityName: string): string => {
    const split = entityName.split('-')
    let shortName = split[split.length - 1]
    shortName = NameSubstitutionMap.get(shortName) || shortName
    return shortName
}

const propertyName = (entityName: string): string => {
    const split = entityName.split('-')
    let shortName = split[split.length - 1]
    NameSubstitutionMap.forEach((value: string, key: string) => {
        if (value == entityName) {
            return key
        }
    })
    return shortName
}

const getSlotNames = (domain: Domain) => {
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
let clAttraction: ConversationLearner
let clHotel: ConversationLearner
let clRestaurant: ConversationLearner
let clTaxi: ConversationLearner
let clTrain: ConversationLearner

const createModels = async () => {
    console.log('========= CREATING MODELS ==========')
    let cl = clFactory.create(modelId)
    const key = clOptions.LUIS_AUTHORING_KEY
    const hashedKey = key ? crypto.createHash('sha256').update(key).digest('hex') : ""
    const id = `MW-${hashedKey}`
    const query = `userId=${id}`
    const appList = await cl.clRunner.clClient.GetApps(query)

    ConversationLearnerFactory.setAppList(appList)

    initCombinedModel()
    initDispatchModel()
    clAttraction = getDomainCL(Domain.ATTRACTION)
    clHotel = getDomainCL(Domain.HOTEL)
    clRestaurant = getDomainCL(Domain.RESTAURANT)
    clTaxi = getDomainCL(Domain.TAXI)
    clTrain = getDomainCL(Domain.TRAIN)
}

server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async context => {

        if (!clDispatch) {
            await createModels()
        }

        if (context.activity.text === "update models") {
            await createModels()
            context.activity.text = "clearinputqueue"
            context.activity.type = BB.ActivityTypes.ConversationUpdate
            return
        }

        if (context.activity.text && context.activity.text.includes("test")) {
            await RunTest(context)
            context.activity.text = "clearinputqueue"
            context.activity.type = BB.ActivityTypes.ConversationUpdate
        }

        if (context.activity.text === "stop") {
            await StopTesting(context)
            context.activity.text = "clearinputqueue"
            context.activity.type = BB.ActivityTypes.ConversationUpdate
        }

        // When running in training UI, ConversationLearner must always have control
        if (await clRestaurant.InTrainingUI(context)) {
            let result = await clRestaurant.recognize(context)
            if (result) {
                return clRestaurant.SendResult(result)
            }
            return
        } else if (await clDispatch.InTrainingUI(context)) {
            let result = await clDispatch.recognize(context)
            if (result) {
                return clDispatch.SendResult(result)
            }
            return
        }

        const result = await clDispatch.recognize(context)

        if (result) {
            return clDispatch.SendResult(result)
        }
    })
})

createModels()

var getActivityResultIntervals: NodeJS.Timeout[] = []
var getActivityResult = (activityId: string) => {
    var promise = new Promise<ActivityResult>((resolve, reject) => {
        let startTime = new Date().getTime()
        var interval = setInterval(
            () => {
                var activityResult = ActivityResults.find(r => r.activityId === activityId)
                if (!activityResult) {
                    console.log(`Expected activity result ${activityId}`)
                    let curTime = new Date().getTime()
                    if (curTime - startTime > 100000) {
                        console.log(`Expire Activity: ${activityId} ${curTime} ${startTime}`)
                        getActivityResultIntervals = getActivityResultIntervals.filter(i => i !== interval)
                        clearInterval(interval)
                    }
                    return
                }
                // LARS check for timeout
                var isDone = true
                activityResult.domainResults.forEach((value: DomainResult | null, key: string) => {
                    if (value == null) {
                        isDone = false
                    }
                })

                if (isDone && isTesting) {
                    getActivityResultIntervals = getActivityResultIntervals.filter(i => i !== interval)
                    clearInterval(interval)
                    // Clear data
                    ActivityResults = ActivityResults.filter(r => r.activityId !== activityId)
                    resolve(activityResult)
                }
            }
            , 1000)
    })
    return promise
}

var testOutputIntervals: NodeJS.Timeout[] = []
var getTestOutput = (activityId: string) => {
    var promise = new Promise<string>((resolve, reject) => {
        let startTime = new Date().getTime()
        var interval = setInterval(
            () => {
                const output = TestOutput.get(activityId)
                if (!output) {
                    let curTime = new Date().getTime()
                    if (curTime - startTime > 150000) {
                        var message = `Expire Output: ${activityId} ${curTime} ${startTime}`
                        console.log(message)
                        testOutputIntervals = testOutputIntervals.filter(i => i !== interval)
                        clearInterval(interval)
                        resolve(message)
                    }
                    return
                }
                testOutputIntervals = testOutputIntervals.filter(i => i !== interval)
                clearInterval(interval)
                if (isTesting) {
                    resolve(output)
                }
            }
            , 1000)
        testOutputIntervals.push(interval)
    })
    return promise
}

const RunTest = async (context: BB.TurnContext) => {
    console.log('========= START TESTING ==========')

    var testDirectory = GetDirectory(TestDirectory)
    var transcriptFileNames = fs.readdirSync(testDirectory)

    // See if I filter to a single test
    var commands = context.activity.text.split(" ")
    if (commands[1]) {
        transcriptFileNames = transcriptFileNames.filter(fn => fn.includes(commands[1]))
    }

    if (transcriptFileNames.length === 0) {
        console.log(`--------- No Matching Dialogs ----------`)
    }
    isTesting = true
    for (var fileName of transcriptFileNames) {
        const transcript = fs.readFileSync(`${testDirectory}\\${fileName}`, 'utf-8')
        console.log(`--------- ${fileName} ----------`)
        await TestTranscript(JSON.parse(transcript), fileName)
        await clDispatch.EndSession(context)
        await clRestaurant.EndSession(context)
        await clAttraction.EndSession(context)
        await clTaxi.EndSession(context)
        await clTrain.EndSession(context)
        await clHotel.EndSession(context)
        if (!isTesting) {
            break
        }
    }

}

let isTesting = true
const StopTesting = async (context: BB.TurnContext) => {
    for (var interval of getActivityResultIntervals) {
        clearInterval(interval)
    }
    for (var interval of testOutputIntervals) {
        clearInterval(interval)
    }
    await clDispatch.EndSession(context)
    await clRestaurant.EndSession(context)
    await clAttraction.EndSession(context)
    await clTaxi.EndSession(context)
    await clTrain.EndSession(context)
    await clHotel.EndSession(context)
    isTesting = false
    console.log('========= END TESTING ==========')
}

const TestTranscript = async (transcript: BB.Activity[], fileName: string) => {

    const adapter = new BB.TestAdapter(async (context) => {
        if (context.activity.text != "test") {
            var result = await clDispatch.recognize(context)

            if (result) {
                return clDispatch.SendResult(result)
            }
        }
    })

    var testResults: TestResult[] = []
    // Need a new conversation ID 
    var conversationId = generateGUID()
    for (var i = 0; i < transcript.length; i = i + 2) {
        var userActivity = transcript[i]
        var agentActivity = transcript[i + 1]
        var error = ""
        if (userActivity.from.role !== BB.RoleTypes.User) {
            var message = `Unexpected agent turn ${i}`
            error += message
            console.log(message)
        }
        if (agentActivity.from.role !== BB.RoleTypes.Bot) {
            var message = `Unexpected user turn ${i}`
            error += message
            console.log(message)
        }
        else if (userActivity.from.role == BB.RoleTypes.User) {
            userActivity.id = generateGUID()
            userActivity.conversation.id = conversationId
            adapter.send(userActivity)
            console.log(`${userActivity.text}`)
            console.log(`${agentActivity.summary}`)
            console.log(`  ${agentActivity.text}`)
            var response = await getTestOutput(userActivity.id!)
            console.log(`< ${response}`)

            var testResult: TestResult =
            {
                input: userActivity.text,
                expected: agentActivity.text,
                actual: response
            }
            if (error != "") {
                testResult.error = error
            }
            testResults.push(testResult)
        }

        if (!isTesting) {
            break
        }
    }
    console.log(`--------- DONE: ${fileName} ----------`)
    fs.writeFileSync(`${GetDirectory(ResultsDirectory)}\\${fileName}`, JSON.stringify(testResults))
}
/*
const makeActivity = (userInput: string) => {

    // LARS transcript name?
    const testId = generateGUID()

    const conversation: BB.ConversationAccount = {
        id: generateGUID(),
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
        id: generateGUID(),
        conversation,
        type: BB.ActivityTypes.Message,
        text: userInput,
        from: fromAccount,
        channelData: { clData: { isValidationTest: true } }
    }

    return activity
}
*/


const generateGUID = (): string => {
    let d = new Date().getTime()
    let guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
        let r = ((d + Math.random() * 16) % 16) | 0
        d = Math.floor(d / 16)
        return (char === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
    return guid
}


export default server
