"use strict";

/**
 * reservation router
 */

const { createCoreRouter } = require("@strapi/strapi").factories;

module.exports = createCoreRouter("api::reservation.reservation", {
  config: {
    update: {
      policies: ["global::isOwner"],
    },
  },
});
