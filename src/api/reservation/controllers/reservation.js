"use strict";

/**
 * reservation controller
 */
const joi = require("joi");
const getPriceSchema = joi.object({
  location: joi.number().required(),
  car: joi.number().required(),
  totalDays: joi.number().required(),
});
const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::reservation.reservation",
  ({ strapi }) => ({
    async getPrice(ctx) {
      const { error } = getPriceSchema.validate(ctx.request.body);
      if (error) {
        return ctx.badRequest(error.message, null);
      }
      const price = await strapi
        .service("api::reservation.reservation")
        .getPrice(
          ctx.request.body.location,
          ctx.request.body.car,
          ctx.request.body.totalDays
        );

      return price;
    },
  })
);
