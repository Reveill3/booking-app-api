module.exports = {
  routes: [
    {
      method: "POST",
      path: "/reservation/getPrice",
      handler: "reservation.getPrice",
    },
    {
      method: "POST",
      path: "/reservation/webhooks",
      handler: "reservation.webhooks",
      config: {
        auth: false,
      },
    },
    {
      method: "POST",
      path: "/reservation/authorize",
      handler: "reservation.authorizePayment",
    },
    {
      method: "POST",
      path: "/reservation/capture",
      handler: "reservation.capturePayment",
    },
    {
      method: "GET",
      path: "/reservations/me",
      handler: "reservation.getMyReservations",
    },
    {
      method: "POST",
      path: "/reservations/me/:id",
      handler: "reservation.deleteOwn",
      config: {
        policies: ["global::isOwner"],
      },
    },
    {
      method: "POST",
      path: "/reservations/stripesession/:id",
      handler: "reservation.getStripeUrl",
      config: {
        policies: ["global::isOwner"],
      },
    },
  ],
};
