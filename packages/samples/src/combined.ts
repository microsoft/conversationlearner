/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import { ConversationLearner, ConversationLearnerFactory, ClientMemoryManager, ReadOnlyClientMemoryManager } from '@conversationlearner/sdk'
import { RestaurantSlot, HotelSlot, AttractionSlot, TaxiSlot, TrainSlot, Domain } from './dataTypes'
import * as Utils from './utils'
import * as App from './app'
import * as DB from './database'

//=================================
// Initialize Combined Model
//=================================
export var OUTPUT = "OUTPUT"


const apiAddOutput = {
    name: "AddOutput",
    logic: async (memoryManager: ClientMemoryManager, intent: string) => {
        memoryManager.Set(OUTPUT, intent)
    }
}


let clCombined: ConversationLearner
export const initCombinedModel = (clFactory: ConversationLearnerFactory) => {
    const modelId = ConversationLearnerFactory.modelIdFromName("combined")
    clCombined = clFactory.create(modelId)

    clCombined.EntityDetectionCallback = async (text: string, memoryManager: ClientMemoryManager): Promise<void> => {
        Utils.ApplyEntitySubstitutions(memoryManager)
        DB.UpdateEntities(memoryManager)
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
            DB.UpdateEntities(memoryManager)
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
            DB.UpdateEntities(memoryManager)
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
            DB.UpdateEntities(memoryManager)
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
            DB.UpdateEntities(memoryManager)
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
            DB.UpdateEntities(memoryManager)
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


            var train = memoryManager.Get(Domain.TRAIN, ClientMemoryManager.AS_STRING)
            if (train !== null && train !== undefined && hday) {
                memoryManager.Set(TrainSlot.DAY, hday as string)
                return
            }

            var hotel = memoryManager.Get(Domain.HOTEL, ClientMemoryManager.AS_STRING)
            if (hotel !== null && hotel !== undefined && tday) {
                memoryManager.Set(HotelSlot.DAY, tday as string)
                return
            }
        }
    })

    //=== DontCare Callbacks ===
    clCombined.AddCallback(App.apiDontCareArea)
    clCombined.AddCallback(App.apiDontCarePrice)
    clCombined.AddCallback(App.apiDontCareFood)
    clCombined.AddCallback(App.apiDontCareArrive)
    clCombined.AddCallback(App.apiDontCareType)
}
