'use strict';

/**
 * add-on service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::add-on.add-on');
