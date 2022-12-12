"use strict";

/**
 * reservation service
 */

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(
  "api::reservation.reservation",
  ({ strapi }) => ({
    async getPrice(location, car, totalDays) {
      const query = {
        filters: {
          $or: [
            {
              locations: {
                id: { $eq: location },
              },
            },
            {
              locations: {
                name: { $eq: "all" },
              },
            },
            {
              cars: {
                id: { $eq: car },
              },
            },
          ],
        },
      };
      const addOns = await strapi.entityService.findMany(
        "api::add-on.add-on",
        query
      );

      const carLookup = await strapi.entityService.findOne(
        "api::car.car",
        car,
        {
          fields: ["dailyRate"],
        }
      );

      const subTotal = carLookup.dailyRate * totalDays;

      const feeTotal = addOns.reduce((acc, addOn) => {
        if (addOn.type === "percentage") {
          return acc + subTotal * addOn.amount;
        }
        return acc + addOn.amount;
      }, 0);

      return subTotal + feeTotal;
    },
  })
);
