"use strict";
const config = require("../config/config"),
    telegram = require('telegram-bot-api'),
    logger = require('../logger/logger');



const api = new telegram({
    token: config.telegram.token,
    updates: {
        enabled: true
    }
});

async function sendTelegram(info) {
    try {
        logger.info.access(`Информация в telegram ${util.inspect(info)}`);
        await api.sendMessage({
            chat_id: config.telegram.chatId,
            text: info
        })
        return '';
    } catch (e) {
        logger.error.error(`Ошибка отправки данных через telegram ${util.inspect(e)}`);
    }

}

module.exports = {
    sendTelegram
}