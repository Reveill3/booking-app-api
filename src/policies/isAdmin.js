module.exports = (policyContext, config, { strapi }) => {
  if (policyContext.state.user.admin) {
    policyContext.unauthorized("You are not allowed to perform this action");
    return true;
  }
  return 401;
};
