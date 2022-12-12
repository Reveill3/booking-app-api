'use strict';

/**
 * add-on router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::add-on.add-on');
