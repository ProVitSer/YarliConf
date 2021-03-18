"use strict";
const { Builder, By, Key, until } = require('selenium-webdriver'),
    config = require("./config"),
    telegram = require('telegram-bot-api'),
    low = require('lowdb'),
    FileSync = require('lowdb/adapters/FileSync'),
    axios = require('axios'),
    moment = require('moment');

const adapter = new FileSync('db.json');
const db = low(adapter);

axios.defaults.withCredentials = true;

let api = new telegram({
    token: '891688089:AAGwdwxxKcYp5mrUtGl_2JqmyuhiecpQgaE',
    updates: {
        enabled: true
    }
});


db.defaults({ conference: [] })
    .write();

async function setInfoToDB(type, data) {
    try {
        console.log(type, data);
        let result = await db.get(type)
            .push(data)
            .write();
        return result;
    } catch {
        sendTelegram(`setInfoToDB ${e}`);
    }
}

async function searchInDBByTheme(theme) {
    try {
        const conference = await db.get('conference')
            .find({ theme: theme })
            .value();
        return conference;
    } catch (e) {
        sendTelegram(`searchInDBByTheme ${e}`);
    }
}

async function searchAllInDB() {
    try {
        const conference = await db.get('conference')
            .value();
        return conference;
    } catch (e) {
        sendTelegram(`searchAllInDB ${e}`);
    }
}

// Удаление информации по переадресации из БД
async function deleteIDInDB(theme) {
    try {
        const resultDelete = await db.get('conference')
            .remove({ theme: theme })
            .write();
        return resultDelete;
    } catch (e) {
        sendTelegram(`deleteIDInDB ${e}`);
    }
}

async function sendTelegram(info) {
    try {
        let result = await api.sendMessage({
            chat_id: -1001329764265,
            text: info
        })
        return '';
    } catch (e) {
        console.log(e);
    }

}

async function addConference(driver, theme, info, date, hour, minute, duration, emailNumberArray) {
    try {

        await driver.get(`https://${config.PBX3cx.url}/webclient/#/conferences/new`);
        await driver.sleep(5000);

        let a = await driver.findElement(By.xpath("//input[@id='radioSchedule']/following::i"))
        a.click();

        //Очистка и внесение даты конференции
        await driver.sleep(5000);
        await driver.findElement(By.id('dateInput')).clear();
        await driver.findElement(By.id('dateInput')).sendKeys(date);
        await driver.sleep(5000);

        // Очистка часа и занесение нового времени конференции. При удаление класса form-group, класс меняется form-group has-error
        await driver.findElement(By.xpath("//td[@class='form-group']/input")).click();
        await driver.findElement(By.xpath("//td[@class='form-group']/input")).clear();
        await driver.findElement(By.xpath("//td[@class='form-group has-error']/input")).sendKeys(hour);

        // Очистка минуты и занесение нового времени конференции. При удаление класса form-group ng-star-inserted, класс меняется form-group ng-star-inserted has-error
        await driver.findElement(By.xpath("//td[@class='form-group ng-star-inserted']/input")).click();
        await driver.findElement(By.xpath("//td[@class='form-group ng-star-inserted']/input")).clear();
        await driver.findElement(By.xpath("//td[@class='form-group ng-star-inserted has-error']/input")).sendKeys(minute);


        // Очистка длительности кор=нференции
        await driver.findElement(By.id('inputDuration')).clear();
        await driver.findElement(By.id('inputDuration')).sendKeys(duration);

        // Тема конференции
        await driver.findElement(By.id('inputName')).sendKeys(theme);
        // Дополнительная информация для участников
        await driver.findElement(By.id('txtDescription')).sendKeys(info);

        //Выберите E-mail / календарь для добавления
        await driver.findElement(By.id("calendarType")).click();
        await driver.sleep(1000);
        await driver.findElement(By.css("option[value='4: 5']")).click();
        await driver.sleep(2000);

        //Список пользователей учавствующих в конференции
        await driver.findElement(By.xpath("//app-sexy-search[@name='searchByNumberInput']/input[@placeholder='Поиск']")).click();

        for (let item in emailNumberArray) {
            await driver.findElement(By.xpath("//app-sexy-search[@name='searchByNumberInput']/input[@placeholder='Поиск']")).sendKeys(emailNumberArray[item]);
            await driver.sleep(5000);
            await driver.findElement(By.xpath("(//find-contact)[2]/div/div/button")).click()
            await driver.sleep(2000);
        }
        await driver.findElement(By.id("btnSave")).click();
        await driver.sleep(2000);

        await searchConference(driver, theme);

        let confId = await driver.findElement(By.xpath("//*[@id='app-container']/ng-component/meeting-layout/div/div[2]/ng-component/div/div[2]/conference-preview/div/div/table/tbody/tr[3]/td[2]/p")).getText();
        await driver.sleep(2000);

        //ID конференции: ${confId}
        let infoToTelegram = `Создана новая конференция 
        Название конференции: ${theme}
        Дата начала: ${date}
        Время начала: ${hour}:${minute}
        Продолжительность: ${duration}
        Примечания: ${info}
        Участники: ${emailNumberArray}
        `
        const data = {
            id: confId,
            theme: theme,
            date: date,
            time: `${hour}:${minute}`,
            info: info,
            member: emailNumberArray
        };

        let resultSend = await sendTelegram(infoToTelegram);
        let resultInsertInDB = await setInfoToDB('conference', data);
        return '';

    } catch (e) {
        sendTelegram(`addConference ${e}`);
    }
};

async function deleteConference(driver, theme) {
    try {
        //await driver.sleep(5000);
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/conferences/list`);
        //await driver.findElement(By.id('btnNewConference')).click();
        await driver.sleep(5000);
        await driver.findElement(By.xpath("//input[@placeholder='Поиск ...']")).click();
        await driver.findElement(By.xpath("//input[@placeholder='Поиск ...']")).sendKeys(theme);
        await driver.sleep(10000);
        await driver.findElement(By.xpath(`//*[contains(text(), ' ${theme} ')]//parent::tr[1]//parent::tbody//parent::table//parent::meeting-list-item//parent::a[@routerlinkactive='selected']`)).click();
        await driver.findElement(By.id("btnDeleteConference")).click();
        await driver.sleep(1000);
        await driver.findElement(By.id("btnOk")).click();
        await driver.sleep(1000);

        //ID конференции: ${confId}
        let infoToTelegram = `Конференция ${theme} удалена или изменилось время проведения`
        let resultSend = await sendTelegram(infoToTelegram);
        return '';
    } catch (e) {
        sendTelegram(`deleteConference ${e}`);
    }
};

async function searchConference(driver, theme) {
    await driver.get(`https://${config.PBX3cx.url}/webclient/#/conferences/list`);
    //await driver.findElement(By.id('btnNewConference')).click();
    await driver.sleep(5000);
    await driver.findElement(By.xpath("//input[@placeholder='Поиск ...']")).click();
    await driver.findElement(By.xpath("//input[@placeholder='Поиск ...']")).sendKeys(theme);
    await driver.sleep(10000);
    await driver.findElement(By.xpath(`//*[contains(text(), ' ${theme} ')]//parent::tr[1]//parent::tbody//parent::table//parent::meeting-list-item//parent::a[@routerlinkactive='selected']`)).click();
}

async function logout(driver) {
    try {
        await driver.sleep(5000);
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/people`);
        await driver.sleep(1000);
        await driver.findElement(By.xpath("//img[@class='ng-star-inserted']")).click();
        await driver.findElement(By.id("menuLogout")).click();
        //driver.quit();
        return '';
    } catch (e) {
        sendTelegram(`logout ${e}`);
    }
}

async function login(driver, organizer) {
    try {
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/login`);
        await driver.wait(until.elementLocated(By.className('btn btn-lg btn-primary btn-block')), 10 * 10000);
        await driver.findElement(By.xpath("//input[@placeholder='Добавочный номер']")).sendKeys(config.login[organizer].exten);
        await driver.findElement(By.xpath("//input[@placeholder='Пароль']")).sendKeys(config.login[organizer].password);
        await driver.findElement(By.className('btn btn-lg btn-primary btn-block')).click();
        await driver.sleep(5000);
        return '';
    } catch (e) {
        sendTelegram(`login ${e}`);
    }
}

async function modifyConference(driver, { theme, organizer, info, date, hour, minute, duration, emailNumberArray }) {
    try {
        console.log(theme, info, date, hour, minute, duration, emailNumberArray);

        let resultSearchInDB = await searchInDBByTheme(theme);
        if (resultSearchInDB == undefined) {
            console.log('Конференции нет создаем');
            await login(driver, organizer);
            //let driver = await new Builder().forBrowser('chrome').build();
            let resultAddConference = await addConference(driver, theme, info, date, hour, minute, duration, emailNumberArray);
            await logout(driver);
            return '';
        } else if (resultSearchInDB.theme == theme && resultSearchInDB.date == date && resultSearchInDB.time == `${hour}:${minute}`) {
            console.log(`Конференция ${theme}, ${info}, ${date}, ${hour}, ${minute}, ${duration}, ${emailNumberArray} уже есть, изменений не требуется`);
            return '';
        } else {
            console.log(`Конференция ${resultSearchInDB} требует изменений`);
            console.log(`Новые данные ${theme}, ${info}, ${date}, ${hour}, ${minute}, ${duration}, ${emailNumberArray}`);
            await login(driver, organizer);
            //let driver = await new Builder().forBrowser('chrome').build();

            let resultDeleteConference = await deleteConference(driver, theme);
            let resultDeleteInDB = await deleteIDInDB(theme);
            let resultAddConference = await addConference(driver, theme, info, date, hour, minute, duration, emailNumberArray);
            await logout(driver);
            return '';
        }
    } catch (e) {
        sendTelegram(`modifyConference ${e}`);
    }
}


// async function checkConference(array) {
//     let resultSearchAllInDB = await searchAllInDB();


//     // for (const key of resultSearchAllInDB) {
//     //     console.log(key);
//     // }
// }

async function getToken() {
    let dataGet = JSON.stringify({ "jsonrpc": "2.0", "id": 1, "method": "Session.login", "params": { "userName": config.mail.username, "password": config.mail.password, "application": { "name": "Sample app", "vendor": "Kerio", "version": "1.0" } } });

    let sendData = {
        method: 'get',
        url: `https://${config.mail.url}/webmail/api/jsonrpc/`,
        headers: {
            'Content-Type': 'application/json'
        },
        data: dataGet
    };

    const res = await axios(sendData, { withCredentials: true });
    const result = await res;

    if (!result) {
        console.log('Отсутствует результат');
        return [];
    }
    let tokenInfo = [result.data.result.token, result.headers['set-cookie']]
    return tokenInfo;
}

async function getConferenceList(token, cookie) {
    let dataPost = JSON.stringify({ "jsonrpc": "2.0", "id": 10, "method": "Occurrences.get", "params": { "query": { "fields": ["id", "eventId", "folderId", "watermark", "access", "summary", "location", "description", "label", "categories", "start", "end", "travelMinutes", "freeBusy", "isPrivate", "isAllDay", "priority", "rule", "attendees", "reminder", "isException", "hasReminder", "isRecurrent", "isCancelled", "seqNumber", "modification", "attachments"], "start": 0, "limit": -1, "combining": "And", "conditions": [{ "fieldName": "start", "comparator": "GreaterEq", "value": "20210317T000000+0300" }, { "fieldName": "end", "comparator": "LessThan", "value": "20210319T000000+0300" }] }, "folderIds": ["keriostorage://folder/yarli.ru/v.prokin/e5040485-6f2d-4e4d-a8b4-921ac958480e"] } });

    let configPost = {
        method: 'post',
        url: `https://${config.mail.url}/webmail/api/jsonrpc/`,
        headers: {

            'Content-Type': 'application/json',
            'Cookie': cookie,
            'X-Token': `${token}`
        },
        data: dataPost
    };

    const res = await axios(configPost, { withCredentials: true });
    const result = await res;

    if (!result) {
        console.log('Отсутствует результат');
        return [];
    }

    return result.data.result;
}


async function modifyConferenceList(info) {
    try {
        let data = [];

        let i = 0;

        for (const key of info.list) {
            let emailNumberArray = [];
            console.log(key);

            for (const { emailAddress }
                of key.attendees) {
                emailNumberArray.push(emailAddress);
            }
            let number = key.description;
            let numberArry = number.split('\n');
            emailNumberArray = emailNumberArray.concat(numberArry);
            data[i] = {
                theme: key.summary,
                organizer: emailNumberArray[0],
                info: `Конференция ${key.summary}`,
                date: moment(key.start).local().format("DD.MM.YYYY"),
                hour: moment(key.start).local().format("HH"),
                minute: moment(key.start).local().format("MM"),
                duration: key.travelMinutes,
                emailNumberArray: emailNumberArray

            };
            i++;
        };

        return data;
    } catch (e) {
        sendTelegram(`modifyConferenceList ${e}`);
    }
}

async function deleteInDBNotUseConference(getConferenceList) {
    try {
        let arrayConfListKerio = [];
        let arrayDeleteConference = [];
        const conference = await db.get('conference')
            .value();
        for (const key of getConferenceList) {
            arrayConfListKerio.push(key.theme);
        }


        for (const key of conference) {
            if (arrayConfListKerio.includes(key.theme) == false && key.theme != "Тест Тестович") {
                if (key.theme.match(/(3CX Conference:) .+/) == null) {
                    arrayDeleteConference.push([key.theme, key.member[0]]);
                }
            }
        }
        console.log(arrayDeleteConference);
        return arrayDeleteConference;
    } catch (e) {
        sendTelegram(`deleteInDBNotUseConference ${e}`);
    }
}

async function startModifyConference() {
    try {
        let driver = await new Builder().forBrowser('chrome').build();

        let resultToken = await getToken();
        let resultGetConferenceList = await getConferenceList(resultToken[0], resultToken[1])
        let resultModifyConferenceList = await modifyConferenceList(resultGetConferenceList);
        console.log(resultModifyConferenceList);

        let resultDeleteNotUseConference = await deleteInDBNotUseConference(resultModifyConferenceList);
        //if (resultDeleteNotUseConference.length != 0) {
        for (const key of resultDeleteNotUseConference) {
            await login(driver, key[1]);
            await deleteConference(driver, key[0]);
            await deleteIDInDB(key[0]);
            await logout(driver);
        }

        //}

        for (const key of resultModifyConferenceList) {
            if (key.theme.match(/(3CX Conference:) .+/) == null) {
                console.log(key);
                await modifyConference(driver, key)
            }

            //console.log(key);
        }
        await driver.quit();
        return '';

    } catch (e) {
        sendTelegram(`startModifyConference ${e}`)
    }
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function init() {
    console.log("Поехали");
    await startModifyConference();
    await delay(5000);
    console.log("Все ок!");
    init();
}

init();