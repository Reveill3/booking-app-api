module.exports = (policyContext, config, { strapi }) => {
  if (policyContext.state.user) {
    return {
      status: 403,
      message: "You are not allowed to access this route",
    };
  }

  return true;
};
