var reddit = require("./nodewhal/nodewhal"),
    chalk = require("chalk"),
    yaml = require("js-yaml"),
    fs = require("fs"),
    figures = require("figures"),
    storage = require("./storage"),
    youtube = require("youtube-get"),
    log = require("./log"),
    version = "ChannelBot 2.0",
    config;


init = function () {

    process.stdout.write(chalk.bold.dim(version) + "\n");
    process.stdout.write(chalk.dim("By Jari Zwarts") + "\n\n");

    try {
        //start the init

        log.loading("configuration");
        config = log.config = yaml.safeLoad(fs.readFileSync("config.yaml", "utf-8"));
        log.loadingOK();

        log.loading("database");
        storage = new storage();
        log.loadingOK();

        log.loading("youtube");
        youtube = new youtube(config.yt_key);
        log.loadingOK();

        log.loading("reddit");
        reddit = new reddit(version);
        reddit.login(config.username, config.password).then(function() {
            log.loadingOK();

            //all systems go
            monitor.start();

        });
    } catch (e) {
        log.loadingFail(e);
    }
};

markPMRead = function(id) {
    reddit.post("/api/read_message", { form: {
        "id": id,
        "uh": reddit.session.modhash
    }});
};

sendPM = function (subject, message) {
    reddit.post("/api/", {
        form: {
        "api_type": "hi"
    }
    });
};

/**
 * monitor monitors incoming PM's, uploads
 */
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
                handler.PM(pm);
            })
        });

    }
};

handler = {
    PM: function(pm) {

        if(pm.was_comment) {
            log.debug("Ignored a comment reply from "+pm.author);
            markPMRead(pm.id);
            return;
        }

        switch(pm.subject.toLowerCase()) {
            case "add":

                break;
            default:

                break;
        }

    }
}


init();