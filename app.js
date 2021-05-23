"use strict";
const { Builder, By, Key, until } = require('selenium-webdriver'),
    util = require('util'),
    moment = require('moment'),
    config = require("./config/config"),
    telegram = require('./src/telegram'),
    logger = require('./logger/logger'),
    db = require('./src/db'),
    selenium = require('./src/selenium'),
    Axios = require('./src/axios');

const axios = new Axios();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function init() {
    logger.access.info(`Начинается обработка данных ${util.inspect(moment().format('YYYY-MM-DD hh:mm:ss'))}`);
    const driver = await new Builder().forBrowser('chrome').build(); //Инициализация web драйвера
    await startModifyConf(driver);
    await driver.quit(); //Выходим из браузера
    await delay(5000);
    init();
}

async function startModifyConf(driver) {
    try {
        //const driver = await new Builder().forBrowser('chrome').build(); //Инициализация web драйвера
        const startDate = moment().format('YYYYMMDDTHH0000+0300');
        const endDate = moment().add(5, 'days').format('YYYYMMDDT000000+0300');
        logger.access.info(`Выгрузка данных за период ${startDate}-${endDate}`);
        const { token, cookie } = await axios.getToken(); //Получение авторизационного токена на Kerio для дальнешего взаимодействия
        const getKerioConferenceList = await axios.getConferenceList(token, cookie, startDate, endDate); //Получение списка конференций из календаря Kerio
        const resultFormatConferenceList = await formatConferenceList(getKerioConferenceList); //Форматирование списка конференций
        const getConferenceListDB = await db.getAllInDB(); //Получение списка конференций которые уже есть в БД(ранее были созданы и добавлены в БД)
        const resultDeleteNotUseConference = await differenceKerioDBConference(resultFormatConferenceList, getConferenceListDB); //Получения списка конференций, которые есть в БД но нет в выгрузки из Kerio. Если такие есть их нужно удалить, так как они не актуальны

        if (resultDeleteNotUseConference.length != 0) {
            for (const conf of resultDeleteNotUseConference) { //['Тема конференции','почта ответственнного по конференции']
                await selenium.login(driver, conf[1]); //Авторизуемся под отвественным пользователем
                await selenium.deleteConference(driver, conf[0]); //Передаем название конференции которуюнадо удалить
                await db.deleteIDInDB(conf[0]); //Удаление конференций, которых нет в выгрузке из Kerio
                await selenium.logout(driver); //Выходим изинтерфейса 3CX
                //await driver.quit(); //Выходим из браузера
            }
        }

        for (const conf of resultFormatConferenceList) {
            await modifyConf(driver, conf); //Добавляем или изменяем существующие конференции
        }

        //await driver.quit(); //Выходим из браузера
        return '';
    } catch (e) {
        logger.error.error(`Ошибка старта получения информации и изменения конференции ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка старта получения информации и изменения конференции startModifyConf`);
    }
}


async function telegramNotification(text, theme, organizer, info, date, hour, minute, duration, emailNumberArray, fio, fioOrganizer) {
    try {
        const infoToTelegram = `${text}\nНазвание конференции: ${theme}\nОрганизатор: ${fioOrganizer}\nДата начала: ${date}\nВремя начала: ${hour}:${minute}\nПродолжительность: ${duration}\nПримечания: ${info}\nУчастники: ${fio}\n`;

        await telegram.sendTelegram(infoToTelegram);
        return '';
    } catch (e) {
        logger.error.error(`Ошибка отправки данных в telegram по новым\измененным конференциям ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка отправки данных в telegram по новым\измененным конференциям telegramNotification`);
    }
}

async function insertInDB(id, theme, organizer, info, date, hour, minute, duration, emailNumberArray, fio, fioOrganizer) {
    try {
        const data = {
            id,
            theme,
            organizer,
            fioOrganizer,
            info,
            date,
            hour,
            minute,
            duration,
            emailNumberArray,
            fio
        };

        await db.setInfoToDB('conference', data);
    } catch (e) {
        logger.error.error(`Ошибка добавления в БД новой информации по конференциям ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка добавления в БД новой информации по конференциям insertInDB`);
    }
}

async function modifyConf(driver, { theme, organizer, info, date, hour, minute, duration, emailNumberArray, fio, fioOrganizer }) {
    try {
        const resultSearchInDB = await db.searchInDBByTheme(theme);

        let diffResult;
        if (resultSearchInDB != undefined) {
            const diff = function(a1, a2) {
                return a1.filter(i => !a2.includes(i))
                    .concat(a2.filter(i => !a1.includes(i)))
            }

            diffResult = diff(resultSearchInDB.emailNumberArray, emailNumberArray);
        }



        //Проверяем существует конференция в БД или нет
        if (resultSearchInDB == undefined) { //Конференции в БД нет, создаем новую конференцию
            await selenium.login(driver, organizer); //Авторизуемся в интерфейсе 3сх под ответственным пользователем
            const confId = await selenium.addConference(driver, theme, info, date, hour, minute, duration, emailNumberArray); // Добавляем новую конференцию
            await telegramNotification(`✅Создана новая концеренция ID ${confId}`, theme, organizer, info, date, hour, minute, duration, emailNumberArray, fio, fioOrganizer); //Уведомляем к группу о создание новой конференции
            await insertInDB(confId, theme, organizer, info, date, hour, minute, duration, emailNumberArray, fio, fioOrganizer); //Добавляем в БД информациюо новой конференции
            await selenium.logout(driver); //Выходим изинтерфейса 3CX
            return '';
        } else if (resultSearchInDB.theme == theme && resultSearchInDB.date == date && resultSearchInDB.hour == `${hour}` && resultSearchInDB.minute == `${minute}` && diffResult.length == 0) { //Конференция уже существует и не требует изменений
            //await driver.quit(); //Выходим из браузера
            return '';
        } else { //Конференция существует, но не совпадает время или дата (пользователь поменял данные). Удаляем и пересоздаем
            await selenium.login(driver, organizer);
            await telegramNotification(`❌Удалена измененная конференция ${resultSearchInDB.id}`, resultSearchInDB.theme, resultSearchInDB.organizer, resultSearchInDB.info, resultSearchInDB.date, resultSearchInDB.hour, resultSearchInDB.minute, resultSearchInDB.duration, resultSearchInDB.emailNumberArray, resultSearchInDB.fio, resultSearchInDB.fioOrganizer);
            await selenium.deleteConference(driver, resultSearchInDB.theme); //Удаляем конференцию в интерфейсе 3СХ
            await db.deleteIDInDB(resultSearchInDB.theme); //Удаляем конференцию из БД
            const confId = await selenium.addConference(driver, theme, info, date, hour, minute, duration, emailNumberArray); //Добавляем новую конференцию, так как были изменение 
            await telegramNotification(`✅Создана новая концеренция ID ${confId}`, theme, organizer, info, date, hour, minute, duration, emailNumberArray, fio, fioOrganizer);
            await insertInDB(confId, theme, organizer, info, date, hour, minute, duration, emailNumberArray, fio, fioOrganizer);
            await selenium.logout(driver);
            //await driver.quit(); //Выходим из браузера
            return '';
        }
    } catch (e) {
        logger.error.error(`Ошибка изменений конференций ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка изменений конференций modifyConf`);
    }
}

async function differenceKerioDBConference(kerioConf, dbConf) {
    try {
        logger.access.info(`Конференции Kerio ${util.inspect(kerioConf)}`);
        logger.access.info(`Конференции из БД ${util.inspect(dbConf)}`);

        let arrayKerioConfTheme = [];
        let arrayDeleteConference = [];

        for (const conf of kerioConf) {
            arrayKerioConfTheme.push(conf.theme);
        };

        for (const conf of dbConf) {
            console.log(arrayKerioConfTheme);
            console.log(arrayKerioConfTheme.includes(conf.theme) == false);
            console.log(conf);
            console.log(conf.theme != "Тест Тестович");
            if (arrayKerioConfTheme.includes(conf.theme) == false && conf.theme != "Тест Тестович") {
                console.log('Удаляем конференцию ', conf.theme);
                arrayDeleteConference.push([conf.theme, conf.organizer]);
            }
        }

        logger.access.info(`Список конференций на удаление ${util.inspect(arrayDeleteConference)}`);
        return arrayDeleteConference;
    } catch (e) {
        logger.error.error(`Ошибка нахождения разницы между конференциями kerio и БД ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка нахождения разницы между конференциями kerio и БД differenceKerioDBConference`);
    }
}


/*
{
   "result":{
      "list":[
         {
            "access":"EAccessCreator",
            "summary":"Новое событие",
            "location":"Telephone-meeting",
            "description":"",
            "categories":[
               
            ],
            "start":"20210507T170000+0300",
            "end":"20210507T180000+0300",
            "attendees":[
               {
                  "displayName":"Виталий",
                  "emailAddress":"vitaliyn@mail.ru",
                  "role":"RoleOrganizer",
                  "isNotified":false,
                  "partStatus":"PartAccepted"
               },
               {
                  "displayName":"Дмитрий",
                  "emailAddress":"dima@mail.ru",
                  "role":"RoleRequiredAttendee",
                  "isNotified":true,
                  "partStatus":"PartAccepted"
               },
               {
                  "displayName":"Telephone-meeting",
                  "emailAddress":"Telephone-meeting@mail.ru",
                  "role":"RoleRoom",
                  "isNotified":true,
                  "partStatus":"PartAccepted"
               }
            ]
         },
         {
            "access":"EAccessCreator",
            "summary":"Test",
            "location":"Telephone-meeting",
            "description":"79998881122\n74999998877",
            "categories":[
               
            ],
            "start":"20210507T190000+0300",
            "end":"20210507T200000+0300",
            "attendees":[
               {
                  "displayName":"Виталий",
                  "emailAddress":"vvitaliyn@mail.ru",
                  "role":"RoleOrganizer",
                  "isNotified":false,
                  "partStatus":"PartAccepted"
               },
               {
                  "displayName":"Telephone-meeting",
                  "emailAddress":"Telephone-meeting@mail.ru",
                  "role":"RoleRoom",
                  "isNotified":true,
                  "partStatus":"PartAccepted"
               }
            ]
         }
      ]
   }
}*/

async function formatConferenceList(info) {
    try {
        let data = [];
        let i = 0;
        logger.access.info(`Список конференций для форматирования ${util.inspect(info)}`);

        for (const conference of info.list) {

            let emailNumberArray = [];
            let usersArray = [];
            let organizer = conference.attendees[1].emailAddress;


            for (const { emailAddress }
                of conference.attendees) {

                if (emailAddress != 'meeting@yarli.ru' && emailAddress != 'Telephone-meeting@yarli.ru') {
                    emailNumberArray.push(config.login[emailAddress.toLowerCase()].exten); //Список почтовых адресов для добавления в конференцию
                    usersArray.push(config.login[emailAddress.toLowerCase()].fio);
                }


            }


            const startTime = moment(moment(conference.start).local().format("DD-MM-YYYY hh:mm:ss"), 'DD-MM-YYYY hh:mm:ss');
            const endTime = moment(moment(conference.end).local().format("DD-MM-YYYY hh:mm:ss"), 'DD-MM-YYYY hh:mm:ss');
            const hoursDiff = endTime.diff(startTime, 'minutes'); //Время конференции из начала и конца конференции

            if (conference.description != "") {
                emailNumberArray = emailNumberArray.concat(conference.description.split('\n')); //Разбиваем на массив номера 79998881122\n74999998877 и добавляем к списку почтовых адресов
                usersArray = usersArray.concat(conference.description.split('\n'));
            }


            data[i] = {
                theme: conference.summary,
                organizer: organizer,
                fioOrganizer: config.login[organizer.toLowerCase()].fio,
                info: `${conference.summary}`,
                date: moment(conference.start).local().format("DD.MM.YYYY"),
                hour: moment(conference.start).local().format("HH"),
                minute: moment(conference.start).local().format("mm"),
                duration: hoursDiff,
                fio: usersArray,
                emailNumberArray: emailNumberArray

            };
            logger.access.info(`Отформатированная конференция ${util.inspect(data[i])}`);
            i++;
        }

        return data;
    } catch (e) {
        logger.error.error(`Ошибка форматирования  данных по конференции ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка форматирования  данных по конференции formatConferenceList`);
    }
}

init();
module.exports = { formatConferenceList };