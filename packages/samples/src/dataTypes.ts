/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

export var DONTCARE = "dontcare"
export var OUTPUT = "OUTPUT"

export enum LuisSlot {
  DAY = "day",
  PEOPLE = "people",
  TIME = "time",
  AREA = "area",
  FOOD = "food",
  PRICE = "price",
  ARRIVE = "arrive",
  DEPART = "depart",
  DESTINATION = "dest",
  LEAVE_AT = "leave",
  STAY = "stay",
  INTERNET = "internet",
  NAME = "name",
  PARKING = "parking",
  STARS = "stars",
  TYPE = "type",
}

export enum TrainSlot {
  ARRIVE_BY = "train-semi-arriveBy",
  DAY = "train-semi-day",
  PEOPLE = "train-book-people",
  DEPARTURE = "train-semi-departure",
  DESTINATION = "train-semi-destination",
  LEAVE_AT = "train-semi-leaveAt",
  CHOICE = "train-choice",
}

export enum RestaurantSlot {
  DAY = "restaurant-book-day",
  AREA = "restaurant-semi-area",
  PEOPLE = "restaurant-book-people",
  FOOD = "restaurant-semi-food",
  NAME = "restaurant-semi-name",
  PRICERANGE = "restaurant-semi-pricerange",
  TYPE = "restaurant-semi-type",
  TIME = "restaurant-book-time",
  CHOICE = "restaurant-choice",
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
}

export enum AttractionSlot {
  AREA = "attraction-semi-area",
  NAME = "attraction-semi-name",
  TYPE = "attraction-semi-type",
  CHOICE = "attraction-choice",
}

export enum TaxiSlot {
  ARRIVE_BY = "taxi-semi-arriveBy",
  DEPARTURE = "taxi-semi-departure",
  DESTINATION = "taxi-semi-destination",
  LEAVE_AT = "taxi-semi-leaveAt",
  CHOICE = "taxi-choice",
}

export enum Domain {
  TAXI = "domain-taxi",
  TRAIN = "domain-train",
  HOTEL = "domain-hotel",
  ATTRACTION = "domain-attraction",
  RESTAURANT = "domain-restaurant",
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
  leaveAt: number[]
  price: string
  trainId: string
}

export interface Taxi {
  taxi_colors: string[]
  taxi_types: string[]
  taxi_phone: string[]
}