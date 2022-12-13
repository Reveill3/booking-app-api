const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const unparsed = require("koa-body/unparsed.js");

("use strict");

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

    async create(ctx) {
      const { location, car, totalDays, start, end } = ctx.request.body;
      try {
        const price = await strapi
          .service("api::reservation.reservation")
          .getPrice(location, car, totalDays);

        const carData = await strapi.service("api::car.car").findOne(car, {
          fields: ["make", "model", "year"],
        });

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "setup",
          success_url: process.env.CLIENT_URL + "?success=true",
          cancel_url: process.env.CLIENT_URL + "?success=false",
        });

        reservationObject = {
          location: location,
          car: car,
          start: start,
          end: end,
          stripeId: session.id,
        };

        return await strapi.service("api::reservation.reservation").create({
          data: reservationObject,
        });
      } catch (error) {
        ctx.response.status = 500;
        return { error };
      }
    },

    async webhooks(ctx) {
      const sig = ctx.request.headers["stripe-signature"];

      let event;

      try {
        event = stripe.webhooks.constructEvent(
          ctx.request.body[unparsed],
          sig,
          "whsec_bfcc2ae708b99838a0c79e4d2c6564d957b706a36c045aa7cd84c769ccb4f619"
        );
      } catch (err) {
        ctx.response.status = 400;
        return { error: `Webhook Error: ${err.message}` };
      }

      switch (event.type) {
        case "checkout.session.completed":
          const handleSessionCompleted = async () => {
            const session = stripe.checkout.sessions.retrieve(
              event.data.object.id
            );
            return session;
          };
          return handleSessionCompleted();
      }
    },
  })
);
