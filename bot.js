var reddit = require("reddit-api"),
    chalk = require("chalk"),
    yaml = require("js-yaml"),
    fs = require("fs"),
    figures = require("figures"),
    storage = require("./storage"),
    youtube = require("youtube-get"),
    log = require("./log"),
    validate = require("validate-obj"),
    version = "ChannelBot 2.0",
    redditurl = "http://www.reddit.com",
    config, modhash;

init = function () {

    validators();

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
        reddit.account.login(config.username, config.password, function(error, data) {
            checkmodhash(data);
            if(error) log.loadingFail(error);
            else {
                log.loadingOK();

                //all systems go
                monitor.start();
            }
        });
    } catch (e) {
        log.loadingFail(e);
    }
};

markPMRead = function(name) {
    reddit._post(redditurl+"/api/read_message", {
        "id": name,
        "uh": modhash
    });
};

sendPM = function (subject, message, to) {
    reddit._post(redditurl+"/api/compose", {
            "api_type": "json",
            "subject": subject,
            "text": message,
            "to": to,
            "uh": modhash
    });
};

/**
 * validators provides some extra validation functions that validate-obj doesn't have
 */
validators = function() {
    validate.register("isAlphaNum", validate.build(function(value, params) {
        if(params && params[0]) var additional = params[0];
        else additional = "";

        var reg = new RegExp("^[a-zA-Z0-9"+additional+"]+$")
        return /^[a-zA-Z0-9]+$/.test(value);
    }, function(name) {
        return name + " must be a alphanumeric string"
    }));
}

/**
 * monitor monitors for incoming PM's, uploads
 */
monitor = {
    start: function () {
        setInterval(this.pms, 2500) || this.pms();
    },

    pms: function () {
        try {
            var unread = reddit.messages.get('unread', function(err, data) {
                checkmodhash(data);
                if(err) {
                    log.error("Can't get unread messages", err);
                    return;
                }
                var keys = Object.keys(data);
                keys.length && keys.forEach(function (key) {
                    var pm = data[key];
                    //handle pm
                    handler.PM(pm.data);
                })
            });
        } catch(e) {
            log.error("Error in monitor.pm thread", e);
        }
    }
};

/**
 * todo api should keep track of this, @michaelowens pls
 */
var checkmodhash = function(data) {
    try {
        if(!data) return;
        if(typeof data == "string") modhash = data;
        else if(typeof data.modhash == "string") modhash = data.modhash;
    } catch(E) {
        debugger;
    }
}

/**
 * handler processes actions the monitor picks up
 */
handler = {
    PM: function(pm) {

        var markReadAndRespond = function(subject, message) {
            log.info("Responded with '"+subject+"'")
            reddit.messages.compose("", "", subject, message, pm.author, modhash, checkmodhash);
            reddit.messages.read(pm.name, modhash, checkmodhash);
        };

        try {
            if(pm.was_comment) {
                log.debug("Ignored a comment reply from "+pm.author);
                reddit.messages.read(pm.name, modhash, checkmodhash);
                return;
            }

            log.info("Got a message from '{0}' with the subject '{1}'!".format(pm.author, pm.subject));

            log.debug("\n----------------\n"+pm.body+"\n----------------");
            log.debug("Processing message:")
            log.debug(figures.pointer+" Parsing...");

            //parse contents
            try {
                var message = yaml.safeLoad(pm.body);
                if(validate.hasErrors(message, validate.isObject)) throw "YAML didn't return a object";
            } catch(e) {
                markReadAndRespond("Unable to parse your message", "Your message contains invalid YAML. For more info, read the [API docs](http://www.reddit.com/r/ChannelBot/wiki/api) and [YAML formatting](https://en.wikipedia.org/wiki/YAML)");
                return;
            }

            switch(pm.subject.toLowerCase()) {
                case "add":
                    log.debug(figures.pointer+" Validating fields");

                    var validation = {
                        subreddit: [validate.required, validate.isString, validate.minLength([1]), validate.isAlphaNum(["_"])],
                        channel_id: [validate.isString, validate.minLength([24]), validate.maxLength([24]), validate.isAlphaNum(["_-"])],
                        channel: [validate.isString, validate.minLength([1]), validate.isAlphaNum],

                        selfCrossValidators: function(message) {
                            if(!"channel" in message && !"channel_id" in message) return "Please provide either 'channel' or 'channel_id'"
                        }
                    };

                    var errors = validate.hasErrors(message, validation, 'message');
                    if(errors) {
                        var reply = "The following error{0} occurred while validating your message: \n\n".format(errors.length > 1 ? "s" : "");
                        errors.forEach(function(error) {
                            reply += "\n\n- {0}\n\n".format(error);
                        });
                        reply += "\n\nDon't forget to read the [docs](http://www.reddit.com/r/ChannelBot/wiki/api)";
                        markReadAndRespond("Unable to add channel", reply);
                        return;
                    }

                    markReadAndRespond("yay", "Successful. I should add something but I'm not programmed to do so yet");

                    break;
                default:
                    markReadAndRespond("Invalid subject.", "Subject needs to be one of the following:\n\n'add', 'list' OR 'remove'.")
                    break;
            }
        } catch(e) {
            log.error("Error while processing PM!", e);
            markReadAndRespond("Internal error", "Couldn't process your message because of a internal error. Please contact the administrator of this bot.");
        }
    }
}

String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
        return typeof args[number] != 'undefined' ? args[number] : match
    });
};


init();