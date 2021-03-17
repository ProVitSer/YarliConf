"use strict";
const { Builder, By, Key, until } = require('selenium-webdriver'),
    config = require("./config/config");

async function searchExtension(date, hour, minute, duration, emailNumberArray) {
    try {
        let driver = await new Builder().forBrowser('chrome').build();
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/login`);
        await driver.wait(until.elementLocated(By.className('btn btn-lg btn-primary btn-block')), 10 * 10000);
        await driver.findElement(By.xpath("//input[@placeholder='Добавочный номер']")).sendKeys(config.PBX3cx.username);
        await driver.findElement(By.xpath("//input[@placeholder='Пароль']")).sendKeys(config.PBX3cx.password);
        await driver.findElement(By.className('btn btn-lg btn-primary btn-block')).click();
        await driver.sleep(5000);
        //await driver.findElement(By.id('menuConferencesClick')).click();

        //await driver.sleep(5000);
        await driver.get(`https://${config.PBX3cx.url}/webclient/#/conferences/new`);

        //await driver.findElement(By.id('btnNewConference')).click();
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
        await driver.findElement(By.id('inputName')).sendKeys('Конференция пиздатых людей');
        // Дополнительная информация для участников
        await driver.findElement(By.id('txtDescription')).sendKeys('Собираем всех пиздатых людей в одном месте');

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



    } catch (e) {
        return;
    }
};