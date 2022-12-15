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
                    stripeId: session.id,
                  },
                });
            } catch (error) {
              ctx.response.status = 500;
              ctx.badRequest(error.message, null);
            }

            return setupIntent;
          };
          return await handleSessionCompleted();
      }
    },
    async authorizePayment(ctx) {
      const { paymentIntentId } = ctx.request.body;
      const authorized = await stripe.paymentIntents.confirm(paymentIntentId);
      return authorized;
    },
    async capturePayment(ctx) {
      const { paymentIntentId } = ctx.request.body;
      const captured = await stripe.paymentIntents.capture(paymentIntentId);
      return captured;
    },
    async getMyReservations(ctx) {
      const reservations = await strapi
        .service("api::reservation.reservation")
        .find({
          users_permissions_user: ctx.state.user.id,
        });
      return reservations;
    },
  })
);
