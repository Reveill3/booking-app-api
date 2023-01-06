'use strict';

/**
 * agreement service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::agreement.agreement');
