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

        const customer = await stripe.customers.create({
          email: ctx.state.user.email,
          name: `${ctx.state.user.first_name} ${ctx.state.user.last_name}`,
          metadata: {
            userId: ctx.state.user.id,
          },
        });

        const reservationObject = {
          location: location,
          car: car,
          start: start,
          end: end,
          total: price,
          users_permissions_user: ctx.state.user.id,
          status: "awaiting_session_complete",
        };

        const reservation = await strapi
          .service("api::reservation.reservation")
          .create({
            data: reservationObject,
          });

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "setup",
          customer: customer.id,
          success_url: process.env.CLIENT_URL + "?success=true",
          cancel_url: process.env.CLIENT_URL + "?success=false",
          metadata: {
            total: price,
            reservation: reservation.id,
          },
        });
        console.log(session.url);
        // add payment intent to reservation
        return await strapi
          .service("api::reservation.reservation")
          .update(reservation.id, {
            data: {
              stripeUrl: session.url,
            },
          });

        return reservation;
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
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        ctx.response.status = 400;
        return { error: `Webhook Error: ${err.message}` };
      }

      switch (event.type) {
        case "checkout.session.completed":
          const handleSessionCompleted = async () => {
            try {
              const session = await stripe.checkout.sessions.retrieve(
                event.data.object.id
              );
              const setupIntent = await stripe.setupIntents.retrieve(
                session.setup_intent
              );

              const customer = await stripe.customers.retrieve(
                setupIntent.customer
              );

              const paymentIntent = await stripe.paymentIntents.create({
                amount: session.metadata.total * 100,
                currency: "usd",
                payment_method_types: ["card"],
                customer: setupIntent.customer,
                payment_method: setupIntent.payment_method,
                setup_future_usage: "off_session",
                capture_method: "manual",
              });
              // add payment intent to reservation
              return await strapi
                .service("api::reservation.reservation")
                .update(session.metadata.reservation, {
                  data: {
                    paymentIntentId: paymentIntent.id,
                    stripeUrl: session.url,
                    status: "awaiting_auth",
                  },
                });
            } catch (error) {
              ctx.internalServerError("Error on session completed");
            }

            return setupIntent;
          };
          return await handleSessionCompleted();
      }
    },
    async authorizePayment(ctx) {
      const { paymentIntentId, reservationId } = ctx.request.body;
      try {
        const authorized = await stripe.paymentIntents.confirm(paymentIntentId);
        await strapi.entityService.update(
          "api::reservation.reservation",
          reservationId,
          {
            data: {
              status: "awaiting_capture",
            },
          }
        );
        return true;
      } catch (error) {
        console.log(error);
        ctx.internalServerError("Error authorizing payment");
      }
    },
    async capturePayment(ctx) {
      const { paymentIntentId, reservationId } = ctx.request.body;
      try {
        const captured = await stripe.paymentIntents.capture(paymentIntentId);
        await strapi.entityService.update(
          "api::reservation.reservation",
          reservationId,
          {
            data: {
              status: "completed",
            },
          }
        );
        return true;
      } catch (error) {
        console.log(error);
        return ctx.internalServerError("Error capturing payment");
      }
    },
    async getMyReservations(ctx) {
      const query = ctx.query;
      const reservations = await strapi.entityService.findMany(
        "api::reservation.reservation",
        {
          filters: { users_permissions_user: ctx.state.user.id },
          populate: ["car", "location"],
        }
      );
      return reservations;
    },

    async deleteOwn(ctx) {
      const { id } = ctx.params;
      const deletedReservation = await strapi.entityService.delete(
        "api::reservation.reservation",
        id
      );
      return deletedReservation;
    },
    async getStripeUrl(ctx) {
      try {
        const reservationId = ctx.params.id;
        const reservation = await strapi.entityService.findOne(
          "api::reservation.reservation",
          reservationId
        );
        const session = await stripe.checkout.sessions.retrieve(
          reservation.stripeId
        );
        return session.url;
      } catch (error) {
        return ctx.notFound(
          "Error retrieving session/reservation or not found"
        );
      }
    },
  })
);
