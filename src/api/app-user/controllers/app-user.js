const bcrypt = require("bcrypt");
("use strict");

/**
 * app-user controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController(
  "api::app-user.app-user",
  ({ strapi }) => ({
    async create(ctx) {
      try {
        const { email, password, role } = ctx.request.body;
        const user = await strapi.query("api::app-user.app-user").findOne({
          email,
        });
        if (user) {
          ctx.response.status = 400;
          return { error: "User already exists" };
        }

        // HASH PASSWORD
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);

        const newUser = await strapi.service("api::app-user.app-user").create({
          data: { email, password: hashedPassword, role },
        });
        return { user: newUser };
      } catch (error) {
        console.log(error);
        ctx.response.status = 500;
        return { error };
      }
    },
  })
);
