const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const unparsed = require("koa-body/unparsed.js");
const { DateTime } = require("luxon");
const axios = require("axios");
const logsnag = require("../../../utils/LogSnag.js");

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
      const { location, car, totalDays, start, end, add_ons } =
        ctx.request.body;

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
          add_ons,
          total_days: totalDays,
        };

        const reservation = await strapi
          .service("api::reservation.reservation")
          .create({
            data: reservationObject,
          });

        // create array of dates between start and end using luxon
        const startDateTime = DateTime.fromISO(start);
        const endDateTime = DateTime.fromISO(end);
        const dates = [];
        let currentDate = startDateTime.plus({ days: 1 });
        while (currentDate.toMillis() < endDateTime.toMillis()) {
          dates.push(currentDate.toISODate());
          currentDate = currentDate.plus({ days: 1 });
        }

        // for each date in dates array , create unavailableDate with reservation id
        for (const date of dates) {
          await strapi
            .service("api::unavailable-date.unavailable-date")
            .create({
              data: {
                date: date,
                car,
                reservation: reservation.id,
              },
            });
        }

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "setup",
          customer: customer.id,
          success_url:
            process.env.CLIENT_URL + "/user/reservations?success=true",
          cancel_url:
            process.env.CLIENT_URL + "/user/reservations?success=false",
          metadata: {
            total: price,
            reservation: reservation.id,
          },
        });
        //Capture event in Logsnag
        await logsnag(
          "Create Reservation",
          `Reservation created for ${carData.make} ${carData.model} ${carData.year} for ${totalDays} days.\nUser: ${ctx.state.user.first_name} ${ctx.state.user.last_name} \nEmail: ${ctx.state.user.email} \nReservation ID: ${reservation.id} \nReservation Total: ${price}`,
          "interactions"
        );

        // add payment intent to reservation
        return await strapi
          .service("api::reservation.reservation")
          .update(reservation.id, {
            data: {
              stripeUrl: session.url,
            },
          });
      } catch (error) {
        //Capture event in Logsnag
        await logsnag(
          "Reservation Error",
          `Error creating reservation for ${ctx.state.user.first_name} ${ctx.state.user.last_name} \nEmail: ${ctx.state.user.email} \nError: ${error}`,
          "errors"
        );
        ctx.internalServerError("Error making reservation", error);
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
              await strapi
                .service("api::reservation.reservation")
                .update(session.metadata.reservation, {
                  data: {
                    paymentIntentId: paymentIntent.id,
                    stripeUrl: session.url,
                    status: "awaiting_auth",
                  },
                });
              return paymentIntent;
            } catch (error) {
              ctx.internalServerError("Error on session completed");
            }
          };
          const response = await handleSessionCompleted();
          //Capture event in Logsnag
          await logsnag(
            "Payment Info Received",
            `Payment info received for reservation ${event.data.object.metadata.reservation}.\nintentId: ${response.id} \nReservation ID: ${event.data.object.metadata.reservation} \nReservation Total: ${event.data.object.metadata.total}`,
            "interactions"
          );
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
          populate: ["car", "location", "add_ons", "users_permissions_user"],
        }
      );
      return reservations;
    },

    async deleteOwn(ctx) {
      const { id } = ctx.params;
      //delete related unavailable dates
      const unavailableDates = await strapi.entityService.findMany(
        "api::unavailable-date.unavailable-date",
        {
          filters: { reservation: id },
        }
      );
      for (const date of unavailableDates) {
        await strapi.entityService.delete(
          "api::unavailable-date.unavailable-date",
          date.id
        );
      }
      const deletedReservation = await strapi.entityService.delete(
        "api::reservation.reservation",
        id
      );

      //Delete stripe paymentIntent using deletedReservation.paymentIntentId
      if (deletedReservation.paymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(
            deletedReservation.paymentIntentId
          );
        } catch (error) {
          ctx.internalServerError("Error deleting payment intent");
        }
      }

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

    async delete(ctx) {
      //delete related unavailable dates and wrap normal delete
      const { id } = ctx.params;
      //delete related unavailable dates
      const unavailableDates = await strapi.entityService.findMany(
        "api::unavailable-date.unavailable-date",
        {
          filters: { reservation: id },
        }
      );
      for (const date of unavailableDates) {
        await strapi.entityService.delete(
          "api::unavailable-date.unavailable-date",
          date.id
        );
      }
      const deletedReservation = await strapi.entityService.delete(
        "api::reservation.reservation",
        id
      );

      //Delete stripe paymentIntent using deletedReservation.paymentIntentId
      if (deletedReservation.paymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(
            deletedReservation.paymentIntentId
          );
        } catch (error) {
          ctx.internalServerError("Error deleting payment intent");
        }
      }

      return deletedReservation;
    },
  })
);
