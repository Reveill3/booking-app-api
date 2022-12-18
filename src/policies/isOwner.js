const utils = require("@strapi/utils");
const { UnauthorizedError, PolicyError } = utils.errors;

module.exports = async (policyContext, config, { strapi }) => {
  if (!policyContext.state.user) {
    throw new UnauthorizedError(
      "You need to be logged in to perform this action",
      { policy: "isOwner" }
    );
  }
  if (policyContext.state.user) {
    try {
      const items = await strapi.entityService.findMany(
        policyContext.request.body.entity,
        {
          populate: ["users_permissions_user"],
          filters: {
            users_permissions_user: { id: policyContext.state.user.id },
            id: policyContext.params.id,
          },
        }
      );
      if (items.length === 0) {
        throw new UnauthorizedError("You can only edit your own reservations", {
          policy: "isOwner",
        });
      }
      return true;
    } catch (error) {
      throw new PolicyError("Server error while fetching item", {
        policy: "isOwner",
        error,
      });
    }
  }
  throw new UnauthorizedError("You are not authorized to perform this action", {
    policy: "isOwner",
  });
};
