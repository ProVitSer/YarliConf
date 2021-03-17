"use strict";
const { Builder, By, Key, until } = require('selenium-webdriver'),
    config = require("./config/config"),
    telegram = require(`telegram-bot-api`),
    low = require('lowdb'),
    FileSync = require('lowdb/adapters/FileSync'),
    axios = require('axios'),
    moment = require('moment');

const adapter = new FileSync('db.json');
const db = low(adapter);

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
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/login`);
        await driver.wait(until.elementLocated(By.className('btn btn-lg btn-primary btn-block')), 10 * 10000);
        await driver.findElement(By.xpath("//input[@placeholder='Добавочный номер']")).sendKeys(config.PBX3cx.username);
        await driver.findElement(By.xpath("//input[@placeholder='Пароль']")).sendKeys(config.PBX3cx.password);
        await driver.findElement(By.className('btn btn-lg btn-primary btn-block')).click();
        await driver.sleep(5000);
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


        let infoToTelegram = `Название конференции: ${theme}
        Дата начала: ${date}
        Время начала: ${hour}:${minute}
        Продолжительность: ${duration}
        ID конференции: ${confId}
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
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/login`);
        await driver.wait(until.elementLocated(By.className('btn btn-lg btn-primary btn-block')), 10 * 10000);
        await driver.findElement(By.xpath("//input[@placeholder='Добавочный номер']")).sendKeys(config.PBX3cx.username);
        await driver.findElement(By.xpath("//input[@placeholder='Пароль']")).sendKeys(config.PBX3cx.password);
        await driver.findElement(By.className('btn btn-lg btn-primary btn-block')).click();
        await driver.sleep(5000);
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
        driver.quit();
        return '';
    } catch (e) {
        sendTelegram(`logout ${e}`);
    }
}


async function modifyConference(theme, info, date, hour, minute, duration, emailNumberArray) {
    try {
        let resultSearchInDB = await searchInDBByTheme(theme);
        if (resultSearchInDB == undefined) {
            console.log('Конференции нет создаем');
            let driver = await new Builder().forBrowser('chrome').build();
            let resultAddConference = await addConference(driver, theme, info, date, hour, minute, duration, emailNumberArray);
            logout(driver);
        } else if (resultSearchInDB.theme == theme && resultSearchInDB.date == date && resultSearchInDB.time == `${hour}:${minute}`) {
            console.log(`Конференция ${theme}, ${info}, ${date}, ${hour}, ${minute}, ${duration}, ${emailNumberArray} уже есть, изменений не требуется`);
        } else {
            console.log(`Конференция ${resultSearchInDB} требует изменений`);
            console.log(`Новые данные ${theme}, ${info}, ${date}, ${hour}, ${minute}, ${duration}, ${emailNumberArray}`);
            let driver = await new Builder().forBrowser('chrome').build();

            let resultDeleteConference = await deleteConference(driver, theme);
            let resultDeleteInDB = await deleteIDInDB(theme);
            let resultAddConference = await addConference(driver, theme, info, date, hour, minute, duration, emailNumberArray);
            logout(driver);
        }
    } catch (e) {
        sendTelegram(e);
    }
}


async function checkConference(array) {
    let resultSearchAllInDB = await searchAllInDB();


    // for (const key of resultSearchAllInDB) {
    //     console.log(key);
    // }
}


//sendTelegram('Конференция пиздатых людей', 'Собираем всех пиздатых людей в одном месте', '17.03.2021', '23', '45', '60', ['va@icepartners.ru', '79250740753'], '564654');
//modifyConference('Конферен', 'Собираем всех пиздатых людей в одном месте', '17.03.2021', '23', '50', '60', ['vp@icepartners.ru', '79250740753']);
//Изменить время, изменить список участников, удалиться

checkConference();




// for (const key of conference) {
//     if (key.theme == theme && key.date == date && key.time == `${hour}:${minute}`) {
//         console.log('Конференция уже есть, изменений не требуется');
//     } else if (key.theme == theme) {
//         console.log('Конференция требует изменений');
//         let resultDeleteConference = await deleteConference(theme);
//         //let resultAddConference = await addConference(theme, info, date, hour, minute, duration, emailNumberArray);
//     } else {
//         console.log('Конференции нет создаем');
//         let resultAddConference = await addConference(theme, info, date, hour, minute, duration, emailNumberArray);
//     }
// }