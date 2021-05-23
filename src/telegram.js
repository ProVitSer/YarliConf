"use strict";
const config = require("../config/config"),
    telegram = require('telegram-bot-api'),
    logger = require('../logger/logger'),
    util = require('util');



const api = new telegram({
    token: config.telegram.token,
    updates: {
        enabled: true
    }
});

async function sendTelegram(info) {
    try {
        logger.access.info(`Информация в telegram ${util.inspect(info)}`);
        const result = await api.sendMessage({
            chat_id: config.telegram.chatId,
            text: info
        })
        return result;
    } catch (e) {
        logger.error.error(`Ошибка отправки данных через telegram ${util.inspect(e)}`);
        throw e;
    }

}

module.exports = {
    sendTelegram
}