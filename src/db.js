"use strict";
const low = require('lowdb'),
    FileSync = require('lowdb/adapters/FileSync'),
    adapter = new FileSync('./db.json'),
    db = low(adapter),
    util = require('util'),
    telegram = require('./telegram'),
    logger = require('../logger/logger');

//Инициализация структуры
db.defaults({ conference: [] })
    .write();

async function setInfoToDB(type, data) {
    try {
        logger.info.access(`Запрос на сохранение данных по конференции ${type} ${util.inspect(data)}`);
        let resultPushInDB = await db.get(type)
            .push(data)
            .write();
        logger.info.access(`Результат  добавление в БД setInfoToDB  ${util.inspect(resultPushInDB)}`);
        return resultPushInDB;
    } catch (e) {
        logger.error.error(`Ошибка добавление данных по конференции ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка добавление данных по конференции setInfoToDB`);
    }
}

async function searchInDBByTheme(theme) {
    try {
        logger.info.access(`Поиск в БД информации по конференции  ${util.inspect(theme)}`);
        const resultSearchConference = await db.get('conference')
            .find({ theme: theme })
            .value();
        logger.info.access(`Результат поиска по теме конференции searchInDBByTheme  ${util.inspect(resultSearchConference)}`);
        return resultSearchConference;
    } catch (e) {
        logger.error.error(`Ошибка поиска данных по конференции ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка поиска данных по конференции searchInDBByTheme`);
    }
}

async function getAllInDB() {
    try {
        const resultSearchAllConference = await db.get('conference')
            .value();
        logger.info.access(`Результат поиска всей информации по конференциям searchAllInDB  ${util.inspect(resultSearchAllConference)}`);
        return resultSearchAllConference;
    } catch (e) {
        logger.error.error(`Ошибка поиска данных по конференцииям ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка поиска данных по конференциям searchAllInDB`);
    }
}

// Удаление информации по переадресации из БД
async function deleteIDInDB(theme) {
    try {
        logger.info.access(`Удаление конференции ${util.inspect(theme)}`);
        const resultDelete = await db.get('conference')
            .remove({ theme: theme })
            .write();
        logger.info.access(`Результат удаление конференции ${util.inspect(resultDelete)}`);
        return resultDelete;
    } catch (e) {
        logger.error.error(`Удаления конференции ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка поиска данных по конференциям deleteIDInDB`);
    }
}


module.exports = {
    setInfoToDB,
    searchInDBByTheme,
    getAllInDB,
    deleteIDInDB
}