require('dotenv').config();
require('../utils/logger');
const { createBotApp } = require('./botApp.js');

// create and start the bot app
createBotApp().catch((err) => {
    console.error('Failed to start bot:', err);
    process.exit(1);
});
