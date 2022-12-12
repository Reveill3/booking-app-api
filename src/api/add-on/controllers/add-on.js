'use strict';

/**
 * add-on controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::add-on.add-on');
