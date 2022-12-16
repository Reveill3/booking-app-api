module.exports = async (policyContext, config, { strapi }) => {
  if (policyContext.request.originalUrl?.includes("webhooks")) {
    return true;
  }
  if (!policyContext.state.user) {
    policyContext.unauthorized(
      "You need to be logged in to perform this action"
    );
    return false;
  }
  if (policyContext.state.user) {
    const item = await strapi.entityService.findOne(
      policyContext.request.body.entity,
      policyContext.request.body.id,
      {
        filters: { users_permissions_user: policyContext.state.user.id },
      }
    );
    if (!item) {
      policyContext.unauthorized("You are not allowed to perform this action");
      return false;
    }
    return true;
  }
  return false;
};
