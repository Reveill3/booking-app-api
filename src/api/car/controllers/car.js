"use strict";

const { DateTime } = require("luxon");
const joi = require("joi");
/**
 * car controller
 */

const schema = joi.object({
  id: joi.number().integer().required(),
  start_date: joi.date().iso().required(),
  end_date: joi.date().iso().required(),
});

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::car.car", ({ strapi }) => ({
  async isAvailable(ctx) {
    // Trigger update
    // Validate the request
    const { error } = schema.validate(ctx.request.body);
    if (error) {
      return ctx.badRequest(null, error.details);
    }
    // Get the car id, start date, end date from the request
    const { id, start_date, end_date } = ctx.request.body;

    // Get the car from the database
    const car = await strapi.entityService.findOne("api::car.car", id, {
      populate: ["unavailable_dates"],
    });

    if (!car.available) {
      return false;
    }

    // Get the reservations for the car
    const reservations = await strapi.entityService.findMany(
      "api::reservation.reservation",
      {
        filters: {
          car: id,
        },
      }
    );

    // create array of dates between start and end using luxon
    const startDateTime = DateTime.fromISO(start_date, { setZone: true });
    const endDateTime = DateTime.fromISO(end_date, { setZone: true });
    const dates = [];
    let currentDate = startDateTime;
    while (currentDate < endDateTime) {
      dates.push(currentDate.toISODate());
      currentDate = currentDate.plus({ days: 1 });
    }

    // Check if the car is available for each date
    for (const date of dates) {
      // Check if the car is unavailable on this date
      const unavailableDate = car.unavailable_dates.find(
        (unavailableDate) =>
          DateTime.fromISO(unavailableDate.date).toISODate() === date
      );

      // If the car is unavailable or reserved, return false
      if (unavailableDate) {
        return false;
      }
    }
    //if start_date and end_date are within 3 hours of any reservations start/end dates, return false
    for (const reservation of reservations) {
      const reservationStartDateTime = DateTime.fromISO(reservation.start);
      const reservationEndDateTime = DateTime.fromISO(reservation.end);
      const reservationStartDateTimeMinus3Hours =
        reservationStartDateTime.minus({
          hours: 3,
        });
      const reservationEndDateTimePlus3Hours = reservationEndDateTime.plus({
        hours: 3,
      });
      if (startDateTime.toISODate() === reservationStartDateTime.toISODate()) {
        return false;
      }

      if (endDateTime.toISODate() === reservationEndDateTime.toISODate()) {
        return false;
      }
      // check if start or end date is on the same day as reservation start or end day
      if (endDateTime.toISODate() === reservationStartDateTime.toISODate()) {
        if (
          endDateTime.toMillis() >=
          reservationStartDateTimeMinus3Hours.toMillis()
        ) {
          return false;
        }
      }

      if (startDateTime.toISODate() === reservationEndDateTime.toISODate()) {
        if (
          startDateTime.toMillis() <=
          reservationEndDateTimePlus3Hours.toMillis()
        ) {
          return false;
        }
      }
    }

    return true;
  },
}));
