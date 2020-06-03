/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
import * as BB from 'botbuilder'
export var DONTCARE = "dontcare"
export var PICK_ONE = "pickone"

export enum LuisSlot {
  DAY = "day",
  PEOPLE = "people",
  TIME = "time",
  AREA = "area",
  FOOD = "food",
  PRICE = "price",
  ARRIVE_BY = "arrive",
  DEPART = "depart",
  DESTINATION = "dest",
  LEAVE_AT = "leave",
  STAY = "stay",
  INTERNET_NO = "internet-no",
  INTERNET_YES = "internet-yes",
  NAME = "name",
  PARKING_NO = "parking-no",
  PARKING_YES = "parking-yes",
  STARS = "stars",
  TYPE = "type",
}

export enum TrainSlot {
  ARRIVE_BY = "train-semi-arriveby",
  ARRIVE_BY_COUNT = "train-arriveby-count",
  DAY = "train-semi-day",
  DAY_COUNT = "train-day-count",
  PEOPLE = "train-book-people",
  DEPART = "train-semi-departure",
  DEPART_COUNT = "train-departure-count",
  DESTINATION = "train-semi-destination",
  DESTINATION_COUNT = "train-destination-count",
  DURATION = "train-duration",
  DURATION_COUNT = "train-duration-count",
  LEAVE_AT = "train-semi-leaveat",
  LEAVE_AT_COUNT = "train-leaveat-count",
  TICKET = "train-ticket",
  TICKET_COUNT = "train-ticket-count",
  ID = "train-id",
  ID_COUNT = "train-id-count",
  CHOICE = "train-choice",
  CHOICE_NONE = "train-choice0",
  CHOICE_TWO = "train-choice2",
  CHOICE_MANY = "train-choiceM",

}

export enum RestaurantSlot {
  ADDRESS = "restaurant-address",
  ADDRESS_COUNT = "restaurant-address-count",
  AREA = "restaurant-semi-area",
  AREA_COUNT = "restaurant-area-count",
  PEOPLE = "restaurant-book-people",
  FOOD = "restaurant-semi-food",
  FOOD_COUNT = "restaurant-food-count",
  NAME = "restaurant-semi-name",
  NAME_COUNT = "restaurant-name-count",
  PHONE = "restaurant-phone",
  PHONE_COUNT = "restaurant-phone-count",
  POSTCODE = "restaurant-postcode",
  POSTCODE_COUNT = "restaurant-postcode-count",
  PRICERANGE = "restaurant-semi-pricerange",
  PRICERANGE_COUNT = "restaurant-pricerange-count",
  TIME = "restaurant-book-time",
  DAY = "restaurant-book-day",
  CHOICE = "restaurant-choice",
  CHOICE_NONE = "restaurant-choice0",
  CHOICE_TWO = "restaurant-choice2",
  CHOICE_MANY = "restaurant-choiceM",
  PICK_ONE = "restaurant-pickone"
}

export enum HotelSlot {
  ADDRESS = "hotel-address",
  ADDRESS_COUNT = "hotel-address-count",
  DAY = "hotel-book-day",
  DAY_COUNT = "hotel--day-count",
  PEOPLE = "hotel-book-people",
  AREA = "hotel-semi-area",
  AREA_COUNT = "hotel-area-count",
  INTERNET = "hotel-semi-internet",
  INTERNET_COUNT = "hotel-internet-count",
  NAME = "hotel-semi-name",
  NAME_COUNT = "hotel-name-count",
  PHONE = "hotel-phone",
  PHONE_COUNT = "hotel-phone-count",
  POSTCODE = "hotel-postcode",
  POSTCODE_COUNT = "hotel-postcode-count",
  TYPE = "hotel-semi-type",
  TYPE_COUNT = "hotel-type-count",
  PARKING = "hotel-semi-parking",
  PARKING_COUNT = "hotel-parking-count",
  PRICERANGE = "hotel-semi-pricerange",
  PRICERANGE_COUNT = "hotel-pricerange-count",
  STARS = "hotel-semi-stars",
  STARS_COUNT = "hotel-stars-count",
  STAY = "hotel-book-stay",
  CHOICE = "hotel-choice",
  CHOICE_NONE = "hotel-choice0",
  CHOICE_TWO = "hotel-choice2",
  CHOICE_MANY = "hotel-choiceM",
  PICK_ONE = "hotel-pickone"
}

export enum AttractionSlot {
  ADDRESS = "attraction-address",
  ADDRESS_COUNT = "attraction-address-count",
  AREA = "attraction-semi-area",
  AREA_COUNT = "attraction-area-count",
  FEE = "attraction-fee",
  FEE_COUNT = "attraction-fee-count",
  OPEN = "attraction-open",
  OPEN_COUNT = "attraction-open-count",
  PHONE = "attraction-phone",
  PHONE_COUNT = "attraction-phone-count",
  POSTCODE = "attraction-postcode",
  POSTCODE_COUNT = "attraction-postcode-count",
  PRICERANGE = "attraction-pricerange",
  PRICERANGE_COUNT = "attraction-pricerange-count",
  NAME = "attraction-semi-name",
  NAME_COUNT = "attraction-name-count",
  TYPE = "attraction-semi-type",
  TYPE_COUNT = "attraction-type-count",
  CHOICE = "attraction-choice",
  CHOICE_NONE = "attraction-choice0",
  CHOICE_TWO = "attraction-choice2",
  CHOICE_MANY = "attraction-choiceM",
  PICK_ONE = "attraction-pickone"
}

export enum TaxiSlot {
  ARRIVE_BY = "taxi-semi-arriveby",
  ARRIVE_BY_COUNT = "taxi-arriveby-count",
  DAY = "taxi-semi-day",
  DAY_COUNT = "taxi-day-count",
  DEPART = "taxi-semi-departure",
  DEPART_COUNT = "taxi-departure-count",
  DESTINATION = "taxi-semi-destination",
  DESTINATION_COUNT = "taxi-destination-count",
  DURATION = "taxi-duration",
  DURATION_COUNT = "taxi-duration-count",
  LEAVE_AT = "taxi-semi-leaveat",
  LEAVE_AT_COUNT = "taxi-leaveat-count",
  TICKET = "taxi-ticket",
  TICKET_COUNT = "taxi-ticket-count",
  ID = "taxi-id",
  ID_COUNT = "taxi-id-count",
  CAR = "taxi-car",
  PHONE = "taxi-phone",
  CHOICE = "taxi-choice",
  CHOICE_NONE = "taxi-choice0",
  CHOICE_TWO = "taxi-choice2",
  CHOICE_MANY = "taxi-choiceM",
  PICK_ONE = "taxi-pickone"
}

export enum Domain {
  TAXI = "taxi",
  TRAIN = "train",
  HOTEL = "hotel",
  ATTRACTION = "attraction",
  RESTAURANT = "restaurant",
}

export interface Restaurant {
  address: string
  area: string
  food: string
  id: string
  introduction: string
  location: number[]
  name: string
  phone: string
  postcode: string
  pricerange: string
  _type: string
}

export interface Attraction {
  address: string
  area: string
  entrancefee: string
  id: string
  introduction: string
  location: number[]
  name: string
  openhours: string
  phone: string
  postcode: string
  pricerange: string
  _type: string
}

export interface Price {
  double: string,
  family: string,
  single: string
}

export interface Hotel {
  address: string
  area: string
  internet: string
  parking: string
  id: string
  location: number[]
  name: string
  phone: string
  postcode: string
  price: Price
  pricerange: string
  stars: string
  takesbookings: string
  _type: string
}

export interface Train {
  arriveBy: string
  day: string
  departure: string
  destination: string
  duration: string
  leaveAt: string
  price: string
  trainID: string
}

export interface Taxi {
  taxi_colors: string[]
  taxi_types: string[]
  taxi_phone: string[]
}

export const NameSubstitutionMap = new Map([
  ["pricerange", "price"],
  ["destination", "dest"],
  ["departure", "depart"],
  ["arriveby", "arrive"],
  ["leaveat", "leave"],
  ["price", "ticket"]
])

export interface ActivityLog extends BB.Transcript {
  goal: Goal
}

export interface Goal {
  taxi: DomainGoal
  police: DomainGoal
  hospital: DomainGoal
  hotel: DomainGoal
  attraction: DomainGoal
  train: DomainGoal
  restaurant: DomainGoal
  message: any
}

export interface DomainGoal {
  info: any
  reqt: any
  fail_info: { [id: string]: string }
  fail_book: { [id: string]: string }
}
