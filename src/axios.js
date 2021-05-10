"use strict";
const axios = require('axios'),
    moment = require('moment'),
    util = require('util'),
    telegram = require('./telegram'),
    config = require("../config/config"),
    logger = require('../logger/logger');


class Axios {
    constructor(ip = config.mail.ip, url = config.mail.url, username = config.mail.username, password = config.mail.password, storage = config.mail.storage) {
        this.ip = ip;
        this.url = url;
        this.username = username;
        this.password = password;
        this.storage = storage;
        this.headers = {
            'User-Agent': 'ProVitSer/0.0.1',
            'Content-Type': 'application/json-rpc; charset=utf-8',

        };
    }

    async sendAxios(method, headers, data) {
        try {
            const sendData = {
                method: method,
                url: `https://${this.ip}/${this.url}`,
                headers: headers,
                data: data
            };

            const res = await axios(sendData, { withCredentials: true });
            const result = await res;

            return result;
        } catch (e) {
            logger.error.error(`Ошибка отправки через Axios ${util.inspect(e)}`);
        }
    }

    async getToken() {
        const json = JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "Session.login",
            "params": {
                "userName": `${this.username}`,
                "password": `${this.password}`,
                "application": {
                    "name": "Sample app",
                    "vendor": "Kerio",
                    "version": "1.0"
                }
            }
        });

        try {
            const result = await this.sendAxios('get', this.headers, json);
            if (result.length = 0) {
                logger.debug.debug(`Отсутствует результат на запрос токена ${util.inspect(e)}`);
                return '';
            };

            const token = result.data.result.token;
            const cookie = result.headers['set-cookie'];
            logger.access.info(`Получен токен  ${util.inspect(token)}`);
            return { token, cookie }

        } catch (e) {
            logger.error.error(`Ошибка получения токена ${util.inspect(e)}`);
            telegram.sendTelegram(`Ошибка получения токена getToken`);
        }
    }

    async getConferenceList(token, cookie, startDate, endDate) {
        const json = JSON.stringify({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "Occurrences.get",
            "params": {
                "query": {
                    "fields": [
                        "access",
                        "summary",
                        "location",
                        "description",
                        "categories",
                        "start",
                        "end",
                        "attendees"
                    ],
                    "start": 0,
                    "limit": -1,
                    "combining": "And",
                    "conditions": [{
                            "fieldName": "start",
                            "comparator": "GreaterEq",
                            "value": startDate
                        },
                        {
                            "fieldName": "end",
                            "comparator": "LessThan",
                            "value": endDate
                        },
                        {
                            "fieldName": "location",
                            "value": "Telephone-meeting"
                        }
                    ]
                },
                "folderIds": [
                    this.storage
                ]
            }
        });

        this.headers['Cookie'] = cookie;
        this.headers['X-Token'] = token;

        try {
            const result = await this.sendAxios('post', this.headers, json);
            if (!result) {
                logger.debug.debug(`Отсутствует результат на запрос списка конференций ${util.inspect(e)}`);
                return '';
            };
            logger.access.info(`Получены данные со списком конференций ${util.inspect(result)}`);
            return result.data.result;

        } catch (e) {
            logger.error.error(`Ошибка запроса списка конференций ${util.inspect(e)}`);
            telegram.sendTelegram(`Ошибка запроса списка конференций getConferenceList`);
        }
    }
}

module.exports = Axios;