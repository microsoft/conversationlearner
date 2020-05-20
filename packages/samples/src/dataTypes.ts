/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export var DONTCARE = "dontcare"

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
  DAY = "train-semi-day",
  PEOPLE = "train-book-people",
  DEPART = "train-semi-departure",
  DESTINATION = "train-semi-destination",
  LEAVE_AT = "train-semi-leaveat",
  CHOICE = "train-choice",
  CHOICE_NONE = "train-choice0",
  CHOICE_TWO = "train-choice2",
  CHOICE_MANY = "train-choiceM",

}

export enum RestaurantSlot {
  DAY = "restaurant-book-day",
  AREA = "restaurant-semi-area",
  PEOPLE = "restaurant-book-people",
  FOOD = "restaurant-semi-food",
  NAME = "restaurant-semi-name",
  PRICERANGE = "restaurant-semi-pricerange",
  TIME = "restaurant-book-time",
  CHOICE = "restaurant-choice",
  CHOICE_NONE = "restaurant-choice0",
  CHOICE_TWO = "restaurant-choice2",
  CHOICE_MANY = "restaurant-choiceM",
}

export enum HotelSlot {
  DAY = "hotel-book-day",
  PEOPLE = "hotel-book-people",
  AREA = "hotel-semi-area",
  INTERNET = "hotel-semi-internet",
  NAME = "hotel-semi-name",
  TYPE = "hotel-semi-type",
  PARKING = "hotel-semi-parking",
  PRICERANGE = "hotel-semi-pricerange",
  STARS = "hotel-semi-stars",
  STAY = "hotel-book-stay",
  CHOICE = "hotel-choice",
  CHOICE_NONE = "hotel-choice0",
  CHOICE_TWO = "hotel-choice2",
  CHOICE_MANY = "hotel-choiceM",
}

export enum AttractionSlot {
  AREA = "attraction-semi-area",
  NAME = "attraction-semi-name",
  TYPE = "attraction-semi-type",
  CHOICE = "attraction-choice",
  CHOICE_NONE = "attraction-choice0",
  CHOICE_TWO = "attraction-choice2",
  CHOICE_MANY = "attraction-choiceM",
}

export enum TaxiSlot {
  ARRIVE_BY = "taxi-semi-arriveby",
  DEPART = "taxi-semi-departure",
  DESTINATION = "taxi-semi-destination",
  LEAVE_AT = "taxi-semi-leaveat",
  CHOICE = "taxi-choice",
  CHOICE_NONE = "taxi-choice0",
  CHOICE_TWO = "taxi-choice2",
  CHOICE_MANY = "taxi-choiceM",
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
