/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as path from 'path'
import * as express from 'express'
import { BotFrameworkAdapter } from 'botbuilder'
import { ConversationLearner, ConversationLearnerFactory, ClientMemoryManager, ReadOnlyClientMemoryManager, FileStorage, uiRouter } from '@conversationlearner/sdk'
import chalk from 'chalk'
import config from './config'
import { Restaurant, Hotel, Attraction, Taxi, Train, RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, LuisSlot, Domain, DONTCARE, OUTPUT } from './dataTypes'
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
const adapter = new BotFrameworkAdapter({ appId: bfAppId, appPassword: bfAppPassword })

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


export interface Result {
    // Used to match import utterances
    activityId: string
    domain: string
    dialogActs: string[]
    entities: string[]
    creationTime?: number
}

let Results: Result[] = []

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

// Move items from general to domain specific and then clear general
const UpdateDomain = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    var day = memoryManager.Get(LuisSlot.DAY, ClientMemoryManager.AS_STRING)
    var people = memoryManager.Get(LuisSlot.PEOPLE, ClientMemoryManager.AS_STRING)
    var time = memoryManager.Get(LuisSlot.TIME, ClientMemoryManager.AS_STRING)
    var area = memoryManager.Get(LuisSlot.AREA, ClientMemoryManager.AS_STRING)
    var food = memoryManager.Get(LuisSlot.FOOD, ClientMemoryManager.AS_STRING)
    var price = memoryManager.Get(LuisSlot.PRICE, ClientMemoryManager.AS_STRING)
    var arrive = memoryManager.Get(LuisSlot.ARRIVE, ClientMemoryManager.AS_STRING)
    var depart = memoryManager.Get(LuisSlot.DEPART, ClientMemoryManager.AS_STRING)
    var dest = memoryManager.Get(LuisSlot.DESTINATION, ClientMemoryManager.AS_STRING)
    var leave = memoryManager.Get(LuisSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)
    var stay = memoryManager.Get(LuisSlot.STAY, ClientMemoryManager.AS_STRING)
    var internet = memoryManager.Get(LuisSlot.INTERNET, ClientMemoryManager.AS_STRING)
    var name = memoryManager.Get(LuisSlot.NAME, ClientMemoryManager.AS_STRING)
    var parking = memoryManager.Get(LuisSlot.PARKING, ClientMemoryManager.AS_STRING)
    var stars = memoryManager.Get(LuisSlot.STARS, ClientMemoryManager.AS_STRING)
    var type_ = memoryManager.Get(LuisSlot.TYPE, ClientMemoryManager.AS_STRING)

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
            memoryManager.Set(RestaurantSlot.DAY, day)
            memoryManager.Delete(LuisSlot.DAY)
        }
        if (people) {
            memoryManager.Set(RestaurantSlot.PEOPLE, people)
            memoryManager.Delete(LuisSlot.PEOPLE)
        }
        if (time) {
            memoryManager.Set(RestaurantSlot.TIME, time)
            memoryManager.Delete(LuisSlot.TIME)
        }
        if (area) {
            memoryManager.Set(RestaurantSlot.AREA, area)
            memoryManager.Delete(LuisSlot.AREA)
        }
        if (food) {
            memoryManager.Set(RestaurantSlot.FOOD, food)
            memoryManager.Delete(LuisSlot.FOOD)
        }
        if (name) {
            memoryManager.Set(RestaurantSlot.NAME, name)
            memoryManager.Delete(LuisSlot.NAME)
        }
        if (price) {
            memoryManager.Set(RestaurantSlot.PRICERANGE, price)
            memoryManager.Delete(LuisSlot.PRICE)
        }
        return
    }
    if (domainFilter === "train") {
        if (people) {
            memoryManager.Set(TrainSlot.PEOPLE, people)
            memoryManager.Delete(LuisSlot.PEOPLE)
        }
        if (arrive) {
            memoryManager.Set(TrainSlot.ARRIVE_BY, arrive)
            memoryManager.Delete(LuisSlot.ARRIVE)
        }
        if (day) {
            memoryManager.Set(TrainSlot.DAY, day)
            memoryManager.Delete(LuisSlot.DAY)
        }
        if (depart) {
            memoryManager.Set(TrainSlot.DEPARTURE, depart)
            memoryManager.Delete(LuisSlot.DEPART)
        }
        if (dest) {
            memoryManager.Set(TrainSlot.DESTINATION, dest)
            memoryManager.Delete(LuisSlot.DESTINATION)
        }
        if (leave) {
            memoryManager.Set(TrainSlot.LEAVE_AT, leave)
            memoryManager.Delete(LuisSlot.LEAVE_AT)
        }
        return
    }
    if (domainFilter === "hotel") {
        if (day) {
            memoryManager.Set(HotelSlot.DAY, day)
            memoryManager.Delete(LuisSlot.DAY)
        }
        if (people) {
            memoryManager.Set(HotelSlot.PEOPLE, people)
            memoryManager.Delete(LuisSlot.PEOPLE)
        }
        if (stay) {
            memoryManager.Set(HotelSlot.STAY, stay)
            memoryManager.Delete(LuisSlot.STAY)
        }
        if (area) {
            memoryManager.Set(HotelSlot.AREA, area)
            memoryManager.Delete(LuisSlot.AREA)
        }
        if (internet) {
            memoryManager.Set(HotelSlot.INTERNET, internet)
            memoryManager.Delete(LuisSlot.INTERNET)
        }
        if (name) {
            memoryManager.Set(HotelSlot.NAME, name)
            memoryManager.Delete(LuisSlot.NAME)
        }
        if (parking) {
            memoryManager.Set(HotelSlot.PARKING, parking)
            memoryManager.Delete(LuisSlot.PARKING)
        }
        if (price) {
            memoryManager.Set(HotelSlot.PRICERANGE, price)
            memoryManager.Delete(LuisSlot.PRICE)
        }
        if (stars) {
            memoryManager.Set(HotelSlot.STARS, stars)
            memoryManager.Delete(LuisSlot.STARS)
        }
        if (type_) {
            memoryManager.Set(HotelSlot.TYPE, type_)
            memoryManager.Delete(LuisSlot.TYPE)
        }
    }
    if (domainFilter === "taxi") {
        if (arrive) {
            memoryManager.Set(TaxiSlot.ARRIVE_BY, arrive)
            memoryManager.Delete(LuisSlot.ARRIVE)
        }
        if (depart) {
            memoryManager.Set(TaxiSlot.DEPARTURE, depart)
            memoryManager.Delete(LuisSlot.DEPART)
        }
        if (dest) {
            memoryManager.Set(TaxiSlot.DESTINATION, dest)
            memoryManager.Delete(LuisSlot.DESTINATION)
        }
        if (leave) {
            memoryManager.Set(TaxiSlot.LEAVE_AT, leave)
            memoryManager.Delete(LuisSlot.LEAVE_AT)
        }
        return
    }
    if (domainFilter === "attraction") {
        if (area) {
            memoryManager.Set(AttractionSlot.AREA, area)
            memoryManager.Delete(LuisSlot.AREA)
        }
        if (name) {
            memoryManager.Set(AttractionSlot.NAME, name)
            memoryManager.Delete(LuisSlot.NAME)
        }
        if (type_) {
            memoryManager.Set(AttractionSlot.TYPE, type_)
            memoryManager.Delete(LuisSlot.TYPE)
        }
        return
    }
}

const UpdateDB = (memoryManager: ClientMemoryManager, domainFilter?: string): void => {
    if (!domainFilter || domainFilter == "restaurant") {
        var restaurant = memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)
        if (restaurant !== null && restaurant !== undefined) {
            var restaurants = RestaurantOptions(memoryManager)
            memoryManager.Set(RestaurantSlot.CHOICE, restaurants.length)
            return
        }
    }
    if (!domainFilter || domainFilter == "hotel") {
        var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
        if (hotel !== null && hotel !== undefined) {
            var hotels = HotelOptions(memoryManager)
            memoryManager.Set(HotelSlot.CHOICE, hotels.length)
        }
    }
    if (!domainFilter || domainFilter == "attraction") {
        var attraction = memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)
        if (attraction !== null && attraction !== undefined) {
            var attractions = AttractionOptions(memoryManager)
            memoryManager.Set(AttractionSlot.CHOICE, attractions.length)
        }
    }
    if (!domainFilter || domainFilter == "taxi") {
        var taxi = memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)
        if (taxi !== null && taxi !== undefined) {
            var taxis = TaxiOptions(memoryManager)
            memoryManager.Set(TaxiSlot.CHOICE, taxis.length)
        }
    }
    if (!domainFilter || domainFilter == "train") {
        var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
        if (train !== null && train !== undefined) {
            var trains = TrainOptions(memoryManager)
            memoryManager.Set(TrainSlot.CHOICE, trains.length)
        }
    }
}

//=================================
// Domain Get Entities
//=================================
const trainEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(TrainSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
        if (value) {
            entities.push(`"${entityName}": "${value}"`)
        }
    })
    var trains = TrainOptions(memoryManager)
    if (trains.length == 1) {
        entities.push(`"train-id": "${trains[0].trainId}"`)
        entities.push(`"train-price": "${trains[0].price}"`)
        entities.push(`"train-duration": "${trains[0].duration}"`)
    }
    return entities
}

const restaurantEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(RestaurantSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
        if (value) {
            entities.push(`"${entityName}": "${value}"`)
        }
    })
    var restaurant = RestaurantOptions(memoryManager)
    if (restaurant.length == 1) {
        entities.push(`"restaurant-address": "${restaurant[0].address}"`)
        entities.push(`"restaurant-phone": "${restaurant[0].phone}"`)
        entities.push(`"restaurant-postcode": "${restaurant[0].postcode}"`)
    }
    return entities
}

const hotelEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(HotelSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
        if (value) {
            entities.push(`"${entityName}": "${value}"`)
        }
    })
    var hotel = HotelOptions(memoryManager)
    if (hotel.length == 1) {
        entities.push(`"hotel-address": "${hotel[0].address}"`)
        entities.push(`"hotel-phone": "${hotel[0].phone}"`)
        entities.push(`"hotel-postcode": "${hotel[0].postcode}"`)
    }
    return entities
}

const attractionEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(AttractionSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
        if (value) {
            entities.push(`"${entityName}": "${value}"`)
        }
    })
    var attraction = AttractionOptions(memoryManager)
    if (attraction.length == 1) {
        entities.push(`"attraction-address": "${attraction[0].address}"`)
        entities.push(`"attraction-phone": "${attraction[0].phone}"`)
        entities.push(`"attraction-postcode": "${attraction[0].postcode}"`)
    }
    return entities
}

const taxiEntities = (memoryManager: ReadOnlyClientMemoryManager): string[] => {
    let entities: string[] = []
    Object.values(TaxiSlot).map(entityName => {
        var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
        if (value) {
            entities.push(`"${entityName}": "${value}"`)
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
        memoryManager.Set(LuisSlot.ARRIVE, DONTCARE)
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

//=================================
// Database & Lookup
//=================================
let DBDirectory = (): string => {
    //TODO - make this configurable
    let dbDirectory = path.join(process.cwd(), './mwdb')

    // Try up a directory or two as could be in /lib or /dist folder depending on deployment
    if (!fs.existsSync(dbDirectory)) {
        dbDirectory = path.join(process.cwd(), '../mwdb')
    }
    if (!fs.existsSync(dbDirectory)) {
        dbDirectory = path.join(process.cwd(), '../../mwdb')
    }
    return dbDirectory
}

var RestaurantOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Restaurant[] => {

    var area = memoryManager.Get(RestaurantSlot.AREA, ClientMemoryManager.AS_STRING)
    var food = memoryManager.Get(RestaurantSlot.FOOD, ClientMemoryManager.AS_STRING)
    var name = memoryManager.Get(RestaurantSlot.NAME, ClientMemoryManager.AS_STRING)
    var pricerange = memoryManager.Get(RestaurantSlot.PRICERANGE, ClientMemoryManager.AS_STRING)
    var _type = memoryManager.Get(RestaurantSlot.TYPE, ClientMemoryManager.AS_STRING)
    var restaurants = RestaurantDb()
    if (area) {
        restaurants = restaurants.filter(r => r.area === area)
    }
    if (food) {
        restaurants = restaurants.filter(r => r.food === food)
    }
    if (name) {
        restaurants = restaurants.filter(r => r.name === name)
    }
    if (pricerange) {
        restaurants = restaurants.filter(r => r.pricerange === pricerange)
    }
    if (_type) {
        restaurants = restaurants.filter(r => r._type === _type)
    }
    return restaurants
}

var AttractionOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Attraction[] => {

    var area = memoryManager.Get(AttractionSlot.AREA, ClientMemoryManager.AS_STRING)
    var name = memoryManager.Get(AttractionSlot.NAME, ClientMemoryManager.AS_STRING)
    var _type = memoryManager.Get(AttractionSlot.TYPE, ClientMemoryManager.AS_STRING)

    //TODO entracneFree / price /etc no semantics ??

    var attraction = AttractionDb()
    if (area) {
        attraction = attraction.filter(r => r.area === area)
    }
    if (name) {
        attraction = attraction.filter(r => r.name === name)
    }
    if (_type) {
        attraction = attraction.filter(r => r._type === _type)
    }
    return attraction
}

var HotelOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Hotel[] => {

    var area = memoryManager.Get(HotelSlot.AREA, ClientMemoryManager.AS_STRING)
    var internet = memoryManager.Get(HotelSlot.INTERNET, ClientMemoryManager.AS_STRING)
    var parking = memoryManager.Get(HotelSlot.PARKING, ClientMemoryManager.AS_STRING)
    var name = memoryManager.Get(HotelSlot.NAME, ClientMemoryManager.AS_STRING)
    var pricerange = memoryManager.Get(HotelSlot.PRICERANGE, ClientMemoryManager.AS_STRING)
    var stars = memoryManager.Get(HotelSlot.STARS, ClientMemoryManager.AS_STRING)
    var _type = memoryManager.Get(HotelSlot.TYPE, ClientMemoryManager.AS_STRING)

    //TODO takesbookings ??

    var hotels = HotelDb()
    if (area) {
        hotels = hotels.filter(r => r.area === area)
    }
    if (internet) {
        hotels = hotels.filter(r => r.internet === internet)
    }
    if (parking) {
        hotels = hotels.filter(r => r.parking === parking)
    }
    if (name) {
        hotels = hotels.filter(r => r.name === name)
    }
    if (pricerange) {
        hotels = hotels.filter(r => r.pricerange === pricerange)
    }
    if (stars) {
        hotels = hotels.filter(r => r.stars === stars)
    }
    if (_type) {
        hotels = hotels.filter(r => r._type === _type)
    }
    return hotels
}

var TrainOptions = (memoryManager: ClientMemoryManager | ReadOnlyClientMemoryManager): Train[] => {

    var arriveBy = memoryManager.Get(TrainSlot.ARRIVE_BY, ClientMemoryManager.AS_STRING)
    var day = memoryManager.Get(TrainSlot.DAY, ClientMemoryManager.AS_STRING)
    var departure = memoryManager.Get(TrainSlot.DEPARTURE, ClientMemoryManager.AS_STRING)
    var destination = memoryManager.Get(TrainSlot.DESTINATION, ClientMemoryManager.AS_STRING)
    var leaveAt = memoryManager.Get(TrainSlot.LEAVE_AT, ClientMemoryManager.AS_STRING)

    //TODO entracneFree / price /etc no semantics ??

    var train = TrainDb()
    if (arriveBy) {
        train = train.filter(r => r.arriveBy === arriveBy)
    }
    if (day) {
        train = train.filter(r => r.day === day)
    }
    if (departure) {
        train = train.filter(r => r.departure === departure)
    }
    if (destination) {
        train = train.filter(r => r.destination === destination)
    }
    if (leaveAt) {
        train = train.filter(r => r.destination === leaveAt)
    }
    return train
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
    const filename = path.join(DBDirectory(), `${databaseName}.json`)
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

            var tdepart = memoryManager.Get(TrainSlot.DEPARTURE, ClientMemoryManager.AS_STRING)
            var xdepart = memoryManager.Get(TaxiSlot.DEPARTURE, ClientMemoryManager.AS_STRING)

            var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
            if (train !== null && train !== undefined && (xdepart)) {
                memoryManager.Set(TrainSlot.DEPARTURE, xdepart as string)
                return
            }

            var taxi = memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)
            if (taxi !== null && taxi !== undefined && (tdepart)) {
                memoryManager.Set(TaxiSlot.DEPARTURE, tdepart as string)
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
        name: "AddOutput",
        logic: async (memoryManager: ClientMemoryManager, intent: string) => {
            const domainEntity = `domain-${intent}`
            memoryManager.Set(OUTPUT, intent)
            memoryManager.Set(domainEntity, intent)
        }
    })

    clDispatch.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId) => {
            memoryManager.Delete(OUTPUT)
            return activityId
        },
        render: async (activityId: string, memoryManager: ReadOnlyClientMemoryManager, ...args: string[]) => {
            var output = Results.find(r => r.activityId === activityId)
            Results = Results.filter(r => r.activityId !== activityId)
            return JSON.stringify(output)
        }
    })
}

const domainInit = (model: ConversationLearner, domain: string) => {

    model.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
        ApplyEntitySubstitutions(memoryManager)
        UpdateEntities(memoryManager, domain)
    }

    model.AddCallback(apiAddOutput)

    //=== DontCare Callbacks ===
    model.AddCallback(apiDontCareArea)
    model.AddCallback(apiDontCarePrice)
    model.AddCallback(apiDontCareFood)
    model.AddCallback(apiDontCareArrive)
    model.AddCallback(apiDontCareType)
}

let clAttraction: ConversationLearner
const initAttractionModel = () => {

    const modelId = ConversationLearnerFactory.modelIdFromName("attraction")
    const model = clFactory.create(modelId)
    domainInit(model, "attraction")

    model.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId: string) => {
            const dialogActs = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            const entities = attractionEntities(memoryManager)
            const result: Result = {
                domain: "attraction",
                activityId,
                dialogActs,
                entities
            }
            Results.push(result)
            memoryManager.Delete(OUTPUT)
        }
    })

    clAttraction = model
}

let clHotel: ConversationLearner
const initHotelModel = () => {

    const modelId = ConversationLearnerFactory.modelIdFromName("hotel")
    const model = clFactory.create(modelId)
    domainInit(model, "hotel")

    model.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId: string) => {
            const dialogActs = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            const entities = hotelEntities(memoryManager)
            const result: Result = {
                domain: "hotel",
                activityId,
                dialogActs,
                entities
            }
            Results.push(result)
            memoryManager.Delete(OUTPUT)
        }
    })
    clHotel = model
}

let clRestaurant: ConversationLearner
const initRestaurantModel = () => {

    const modelId = ConversationLearnerFactory.modelIdFromName("restaurant")
    const model = clFactory.create(modelId)
    domainInit(model, "restaurant")

    model.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId: string) => {
            const dialogActs = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            const entities = restaurantEntities(memoryManager)
            const result: Result = {
                domain: "restaurant",
                activityId,
                dialogActs,
                entities
            }
            Results.push(result)
            memoryManager.Delete(OUTPUT)
        }
    })
    clRestaurant = model
}

let clTaxi: ConversationLearner
const initTaxiModel = () => {

    const modelId = ConversationLearnerFactory.modelIdFromName("taxi")
    const model = clFactory.create(modelId)
    domainInit(model, "taxi")

    model.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId: string) => {
            const dialogActs = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            const entities = taxiEntities(memoryManager)
            const result: Result = {
                domain: "taxi",
                activityId,
                dialogActs,
                entities
            }
            Results.push(result)
            memoryManager.Delete(OUTPUT)
        }
    })
    clTaxi = model
}

let clTrain: ConversationLearner
const initTrainModel = () => {

    const modelId = ConversationLearnerFactory.modelIdFromName("train")
    const model = clFactory.create(modelId)
    domainInit(model, "train")

    model.AddCallback({
        name: "SendOutput",
        logic: async (memoryManager: ClientMemoryManager, activityId: string) => {
            const dialogActs = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
            const entities = trainEntities(memoryManager)
            const result: Result = {
                domain: "train",
                activityId,
                dialogActs,
                entities
            }
            Results.push(result)
            memoryManager.Delete(OUTPUT)
        }
    })

    clTrain = model
}

const createModels = async () => {
    let cl = clFactory.create(modelId)
    const key = clOptions.LUIS_AUTHORING_KEY
    const hashedKey = key ? crypto.createHash('sha256').update(key).digest('hex') : ""
    const id = `MW-${hashedKey}`
    const query = `userId=${id}`
    const appList = await cl.clRunner.clClient.GetApps(query)

    ConversationLearnerFactory.setAppList(appList)

    initCombinedModel()
    initDispatchModel()
    initAttractionModel()
    initHotelModel()
    initRestaurantModel()
    initTaxiModel()
    initTrainModel()

    console.log(clTrain)
    console.log(clTaxi)
    console.log(clHotel)
    console.log(clAttraction)
    console.log(clRestaurant)
}

server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async context => {

        if (!clDispatch) {
            await createModels()
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

        /*
        const result = await cl.recognize(context)

        if (result) {
            return cl.SendResult(result)
        }
        */
    })
})

export default server
