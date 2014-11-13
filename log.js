var chalk = require("chalk"),
    figures = require("figures"),
    logerrors = require("log-errors");

var Log = {
    config: undefined,

    loading: function (what) {
        process.stdout.write(chalk.bold("Loading " + what + "... "));
    },

    loadingOK: function () {
        process.stdout.write(chalk.green(figures.tick) + " OK!\n");
    },

    loadingFail: function (error) {
        process.stdout.write(chalk.red(figures.cross) + " Fail\n");
        if (error) throw error;
        else process.exit(1);
    },

    error: function (msg, error) {
        if (!this.config || (this.config && this.config.log.indexOf('error') != -1)) {
            process.stdout.write(chalk.red(figures.circleCross + " " + msg) + "\n");
            if(error && (!this.config || (this.config && this.config.log.indexOf('debug') != -1))) {
                logerrors.development(error);
            } else if(error) {
                logerrors.production(error);
            }
        }
    },

    info: function (msg) {
        if (!this.config || (this.config && this.config.log.indexOf('info') != -1))
            process.stdout.write(chalk.blue(figures.info + " " + msg) + "\n");
    },

    debug: function(msg) {
        if (!this.config || (this.config && this.config.log.indexOf('debug') != -1))
            process.stdout.write(chalk.green(figures.circleCircle+ " " + msg) + "\n");
    },

    warn: function(msg) {
        if (!this.config || (this.config && this.config.log.indexOf('warn') != -1))
            process.stdout.write(chalk.yellow(figures.warning+ " " + msg) + "\n");
    }
};

module.exports = Log;