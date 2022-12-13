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
  ],
};
