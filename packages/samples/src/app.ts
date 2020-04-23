/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as path from 'path'
import * as express from 'express'
import { BotFrameworkAdapter } from 'botbuilder'
import { ConversationLearnerFactory, ClientMemoryManager, ReadOnlyClientMemoryManager, FileStorage, uiRouter } from '@conversationlearner/sdk'
import chalk from 'chalk'
import config from './config'
import { Restaurant, Hotel, Attraction, Taxi, Train, RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, LuisSlot, Domain, DONTCARE, OUTPUT } from './dataTypes'
import * as fs from 'fs'

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
const conversationLearnerFactory = new ConversationLearnerFactory(clOptions, fileStorage)

const includeSdk = ['development', 'test'].includes(process.env.NODE_ENV ?? '')
if (includeSdk) {
    console.log(chalk.cyanBright(`Adding /sdk routes`))
    server.use('/sdk', conversationLearnerFactory.sdkRouter)

    // Note: Must be mounted at root to use internal /ui paths
    console.log(chalk.greenBright(`Adding /ui routes`))
    server.use(uiRouter as any)
}

// Serve default bot summary page. Should be customized by customer.
server.use(express.static(path.join(__dirname, '..', 'site')))

const cl = conversationLearnerFactory.create(modelId)

//=================================
// Add Entity Logic
//=================================
/**
* @param {string} text Last user input to the Bot
* @param {ClientMemoryManager} memoryManager Allows for viewing and manipulating Bot's memory
* @returns {Promise<void>}
*/
cl.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
    ApplyEntitySubstitutions(memoryManager)
    UpdateEntities(memoryManager)
}

var UpdateEntities = (memoryManager: ClientMemoryManager): void => {
    UpdateDomain(memoryManager)
    UpdateDB(memoryManager)

}

// Apply substitutions (i.e. "0-star" = "0")
var ApplyEntitySubstitutions = (memoryManager: ClientMemoryManager): void => {
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
var UpdateDomain = (memoryManager: ClientMemoryManager): void => {
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

    var restaurant = memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)
    if (restaurant !== null && restaurant !== undefined) {
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

    var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
    if (train !== null && train !== undefined) {
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

    var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
    if (hotel !== null && hotel !== undefined) {
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

    var taxi = memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)
    if (taxi !== null && taxi !== undefined) {
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

    var attraction = memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)
    if (attraction !== null && attraction !== undefined) {
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

var UpdateDB = (memoryManager: ClientMemoryManager): void => {
    var restaurant = memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)
    if (restaurant !== null && restaurant !== undefined) {
        var restaurants = RestaurantOptions(memoryManager)
        memoryManager.Set(RestaurantSlot.CHOICE, restaurants.length)
        return
    }
    var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
    if (hotel !== null && hotel !== undefined) {
        var hotels = HotelOptions(memoryManager)
        memoryManager.Set(HotelSlot.CHOICE, hotels.length)
    }
    var attraction = memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)
    if (attraction !== null && attraction !== undefined) {
        var attractions = AttractionOptions(memoryManager)
        memoryManager.Set(AttractionSlot.CHOICE, attractions.length)
    }
    var taxi = memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)
    if (taxi !== null && taxi !== undefined) {
        var taxis = TaxiOptions(memoryManager)
        memoryManager.Set(TaxiSlot.CHOICE, taxis.length)
    }
    var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
    if (train !== null && train !== undefined) {
        var trains = TrainOptions(memoryManager)
        memoryManager.Set(TrainSlot.CHOICE, trains.length)
    }
}

//=================================
// Output
//=================================
cl.AddCallback({
    name: "AddOutput",
    logic: async (memoryManager: ClientMemoryManager, intent: string) => {
        memoryManager.Set(OUTPUT, intent)
    }
})

cl.AddCallback({
    name: "SendOutput",
    logic: async (memoryManager: ClientMemoryManager) => {
        var output = memoryManager.Get(OUTPUT, ClientMemoryManager.AS_STRING_LIST)
        memoryManager.Delete(OUTPUT)
        return output
    },
    render: async (intents: any, memoryManager: ReadOnlyClientMemoryManager) => {
        var entities: string[] = []
        if (memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)) {
            Object.values(TrainSlot).map(entityName => {
                var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
                if (value) {
                    entities.push(`"${entityName}": "${value}"`)
                }
            })
        }
        if (memoryManager.Get(Domain.RESTAURANT, ClientMemoryManager.AS_STRING)) {
            Object.values(RestaurantSlot).map(entityName => {
                var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
                if (value) {
                    entities.push(`"${entityName}": "${value}"`)
                }
            })
        }

        if (memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)) {
            Object.values(HotelSlot).map(entityName => {
                var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
                if (value) {
                    entities.push(`"${entityName}": "${value}"`)
                }
            })
        }

        if (memoryManager.Get(Domain.ATTRACTION, ClientMemoryManager.AS_STRING)) {
            Object.values(AttractionSlot).map(entityName => {
                var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
                if (value) {
                    entities.push(`"${entityName}": "${value}"`)
                }
            })
        }

        if (memoryManager.Get(Domain.TAXI, ClientMemoryManager.AS_STRING)) {
            Object.values(TaxiSlot).map(entityName => {
                var value = memoryManager.Get(entityName, ClientMemoryManager.AS_STRING)
                if (value) {
                    entities.push(`"${entityName}": "${value}"`)
                }
            })
        }
        return `${intents.join(", ")} {${entities.join(", ")}}`
    }
})

//=================================
// Define any API callbacks
//=================================
cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

//=================================
// dontcare-
//=================================
cl.AddCallback<number>({
    name: "dontcare-area",
    logic: async (memoryManager) => {
        memoryManager.Set(LuisSlot.AREA, DONTCARE)
        UpdateEntities(memoryManager)
    }
})

cl.AddCallback<number>({
    name: "dontcare-price",
    logic: async (memoryManager) => {
        memoryManager.Set(LuisSlot.PRICE, DONTCARE)
        UpdateEntities(memoryManager)
    }
})

cl.AddCallback<number>({
    name: "dontcare-food",
    logic: async (memoryManager) => {
        memoryManager.Set(LuisSlot.FOOD, DONTCARE)
        UpdateEntities(memoryManager)
    }
})

cl.AddCallback<number>({
    name: "dontcare-arrive",
    logic: async (memoryManager) => {
        memoryManager.Set(LuisSlot.ARRIVE, DONTCARE)
        UpdateEntities(memoryManager)
    }
})

cl.AddCallback<number>({
    name: "dontcare-type",
    logic: async (memoryManager) => {
        memoryManager.Set(LuisSlot.TYPE, DONTCARE)
        UpdateEntities(memoryManager)
    }
})

//=================================
// same-
//=================================
cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

cl.AddCallback<number>({
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

var RestaurantOptions = (memoryManager: ClientMemoryManager): Restaurant[] => {

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

var AttractionOptions = (memoryManager: ClientMemoryManager): Attraction[] => {

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

var HotelOptions = (memoryManager: ClientMemoryManager): Hotel[] => {

    var area = memoryManager.Get(HotelSlot.AREA, ClientMemoryManager.AS_STRING)
    var internet = memoryManager.Get(HotelSlot.INTERNET, ClientMemoryManager.AS_STRING)
    var parking = memoryManager.Get(HotelSlot.PARKING, ClientMemoryManager.AS_STRING)
    var name = memoryManager.Get(HotelSlot.NAME, ClientMemoryManager.AS_STRING)
    var pricerange = memoryManager.Get(HotelSlot.PRICERANGE, ClientMemoryManager.AS_STRING)
    var stars = memoryManager.Get(HotelSlot.STARS, ClientMemoryManager.AS_STRING)
    var _type = memoryManager.Get(HotelSlot.TYPE, ClientMemoryManager.AS_STRING)

    //TODO takesbookings ??

    var hotel = HotelDb()
    if (area) {
        hotel = hotel.filter(r => r.area === area)
    }
    if (internet) {
        hotel = hotel.filter(r => r.internet === internet)
    }
    if (parking) {
        hotel = hotel.filter(r => r.parking === parking)
    }
    if (name) {
        hotel = hotel.filter(r => r.name === name)
    }
    if (pricerange) {
        hotel = hotel.filter(r => r.pricerange === pricerange)
    }
    if (stars) {
        hotel = hotel.filter(r => r.stars === stars)
    }
    if (_type) {
        hotel = hotel.filter(r => r._type === _type)
    }
    return hotel
}

var TrainOptions = (memoryManager: ClientMemoryManager): Train[] => {

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

var TaxiOptions = (memoryManager: ClientMemoryManager): Taxi[] => {
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
// Handle Incoming Messages
//=================================
server.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async context => {
        const result = await cl.recognize(context)

        if (result) {
            return cl.SendResult(result)
        }
    })
})

export default server