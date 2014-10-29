var ChannelBot = function (reddit, chalk, yaml, fs, figures) {
    var config, reddit = new reddit();


    this.init = function () {

        this.loading("configuration");

        fs.readFileSync("config.yaml", "utf-8", function(err, data) {
            if(err) this.loadingFail(err);
            else {
                try {
                    config = yaml.safeLoad(data);
                    this.loadingOK();
                } catch (e) {
                    this.loadingFail(e);
                    return;
                }
            }
        });



        this.loading("reddit");
        reddit.login("test", "holla", function (error, success) {
            if (error) this.loadingFail();
            else {
                this.loadingOK();
            }
        });
    }

    this.loading = function (what) {
        process.stdout.write(chalk.white.bold("Loading " + what + "... "));
    }

    this.loadingOK = function () {
        process.stdout.write(chalk.green(figures.tick + " OK!\n"));
    }

    this.loadingFail = function (error) {
        process.stdout.write(chalk.red(figures.cross + " Fail\n"));
        if (error) throw error;
    }

    this.error = function (msg) {
        if (!config || (config && config.log.error))
            process.stdout.write(chalk.red(msg) + "\n");
    }

    this.info = function (msg) {
        if (!config || (config && config.log.info))
            process.stdout.write(chalk.white(msg) + "\n");
    }


    this.init();
}(
    require("./nodewhal/nodewhal"),
    require("chalk"),
    require("js-yaml"),
    require("fs"),
    require("figures")
);