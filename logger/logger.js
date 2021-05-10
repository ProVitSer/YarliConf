"use strict";
const log4js = require(`log4js`);

log4js.configure({
    appenders: {
        access: {
            type: `file`,
            filename: `logs/access.log`,
            maxLogSize: 10485760,
            backups: 3,
            compress: true
        },
        debug: {
            type: `file`,
            filename: `logs/debug.log`,
            maxLogSize: 10485760,
            backups: 3,
            compress: true
        },
        error: {
            type: `file`,
            filename: `logs/error.log`,
            maxLogSize: 10485760,
            backups: 3,
            compress: true
        }
    },
    categories: {
        access: {
            appenders: [`access`],
            level: `debug`
        },
        debug: {
            appenders: [`debug`],
            level: `debug`
        },
        error: {
            appenders: [`error`],
            level: `error`
        }
    }
});

module.exports = {
    info: log4js.getLogger('access'),
    debug: log4js.getLogger('debug'),
    error: log4js.getLogger('error'),
};