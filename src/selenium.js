const { Builder, By, until } = require('selenium-webdriver'),
    util = require('util'),
    db = require('./db'),
    telegram = require('./telegram'),
    config = require("../config/config"),
    logger = require('../logger/logger');


async function login(driver, email) {
    try {
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/login`);
        await driver.wait(until.elementLocated(By.className('btn btn-lg btn-primary btn-block')), 10 * 10000);
        await driver.findElement(By.xpath("//input[@placeholder='Добавочный номер']")).sendKeys(config.login[email].exten);
        await driver.findElement(By.xpath("//input[@placeholder='Пароль']")).sendKeys(config.login[email].password);
        await driver.findElement(By.className('btn btn-lg btn-primary btn-block')).click();
        await driver.sleep(5000);
        return '';
    } catch (e) {
        logger.error.error(`Ошибка авторизации на 3СХ ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка авторизации на 3СХ login`);
    }
}

async function logout(driver) {
    try {
        await driver.sleep(5000);
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/people`);
        await driver.sleep(1000);
        await driver.findElement(By.xpath("//img[@class='ng-star-inserted']")).click();
        await driver.findElement(By.id("menuLogout")).click();
        return '';
    } catch (e) {
        logger.error.error(`Ошибка выходаих web интерфейса 3СХ ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка выходаих web интерфейса 3СХ logout`);
    }
}

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
        await telegram.sendTelegram(`Конференция ${theme} удалена или изменилось время проведения`);
        return '';
    } catch (e) {
        logger.error.error(`Ошибка удаления конференции на 3СХ  ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка удаления конференции на 3СХ deleteConference`);
    }
}

async function addConference(driver, theme, info, date, hour, minute, duration, emailNumberArray) {
    try {

        await driver.get(`https://${config.PBX3cx.url}/webclient/#/conferences/new`);
        await driver.sleep(5000);

        const radioSchedule = await driver.findElement(By.xpath("//input[@id='radioSchedule']/following::i"))
        radioSchedule.click();

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


        // Очистка длительности корнференции
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

        //Поисксозданной конференции
        await searchConference(driver, theme);

        //Получение уникального ID конференции
        const confId = await driver.findElement(By.xpath("//*[@id='app-container']/ng-component/meeting-layout/div/div[2]/ng-component/div/div[2]/conference-preview/div/div/table/tbody/tr[3]/td[2]/p")).getText();
        await driver.sleep(2000);
        return confId;



    } catch (e) {
        logger.error.error(`Ошибка добавление конференции на 3СХ ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка добавление конференции на 3СХ addConference`);
    }
}

async function searchConference(driver, theme) {
    try {
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/conferences/list`);
        await driver.sleep(5000);
        await driver.findElement(By.xpath("//input[@placeholder='Поиск ...']")).click();
        await driver.findElement(By.xpath("//input[@placeholder='Поиск ...']")).sendKeys(theme);
        await driver.sleep(10000);
        await driver.findElement(By.xpath(`//*[contains(text(), ' ${theme} ')]//parent::tr[1]//parent::tbody//parent::table//parent::meeting-list-item//parent::a[@routerlinkactive='selected']`)).click();
    } catch (e) {
        logger.error.error(`Ошибка поиска конференции на 3СХ ${util.inspect(e)}`);
        telegram.sendTelegram(`Ошибка поиска конференции на 3СХ searchConference`);
    }

}

module.exports = {
    login,
    deleteConference,
    logout,
    addConference,
    searchConference
}