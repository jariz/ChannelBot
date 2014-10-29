var reddit = require("./nodewhal/nodewhal"),
    chalk = require("chalk"),
    yaml = require("js-yaml"),
    fs = require("fs"),
    figures = require("figures"),
    storage = require("./storage"),
    youtube = require("youtube-get"),
    version = "ChannelBot 2.0",
    config;


init = function () {

    process.stdout.write(chalk.bold.dim(version) + "\n");
    process.stdout.write(chalk.dim("By Jari Zwarts") + "\n\n");

    try {
        //start the init

        loading("configuration");
        config = yaml.safeLoad(fs.readFileSync("config.yaml", "utf-8"));
        loadingOK();

        loading("database");
        storage = new storage();
        loadingOK();

        loading("youtube");
        youtube = new youtube(config.yt_key);
        loadingOK();

        loading("reddit");
        reddit = new reddit(version);
        reddit.login(config.username, config.password).then(function() {
            loadingOK();

            //all systems go
            monitor.start();

        });
    } catch (e) {
        loadingFail(e);
    }
};

monitor = {
    start: function () {
        setInterval(this.pms, 2500) || this.pms();
    },

    pms: function () {
        var unread = reddit.listing('/message/unread').then(function(data) {
            var keys = Object.keys(data);
            keys.length && keys.forEach(function(key) {
                var pm = data[key];
                //handle pm
                this.info("received: "+pm.subject);
            })
        });

    }
};

loading = function (what) {
    process.stdout.write(chalk.bold("Loading " + what + "... "));
};

loadingOK = function () {
    process.stdout.write(chalk.green(figures.tick) + " OK!\n");
};

loadingFail = function (error) {
    process.stdout.write(chalk.red(figures.cross) + " Fail\n");
    if (error) throw error;
    else process.exit(1);
};

error = function (msg) {
    if (!config || (config && config.log.indexOf('error') != -1))
        process.stdout.write(chalk.red(msg) + "\n");
};

info = function (msg) {
    if (!config || (config && config.log.indexOf('info') != -1))
        process.stdout.write(chalk.blue(msg) + "\n");
};


init();