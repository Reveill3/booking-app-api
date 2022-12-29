module.exports = {
  routes: [
    {
      method: "POST",
      path: "/car/isAvailable",
      handler: "car.isAvailable",
      config: {
        auth: false,
      },
    },
  ],
};
