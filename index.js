#!/usr/bin/env node

/**
 * Bootstrap file that initializes babel & the bot
 */

require("babel-register");
require("babel-polyfill");
require("./bot");