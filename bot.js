var ChannelBot = function (reddit, chalk, yaml, fs, figures, storage, youtube) {
    this.version = "ChannelBot 2.0.0.0";

    var config, reddit = new reddit(this.version);


    this.init = function () {

        process.stdout.write(chalk.bold.dim(this.version) + "\n");
        process.stdout.write(chalk.dim("By Jari Zwarts") + "\n\n");

        try {
            //start the init

            this.loading("configuration");
            config = yaml.safeLoad(fs.readFileSync("config.yaml", "utf-8"));
            this.loadingOK();

            this.loading("database");
            storage = new storage();
            this.loadingOK();

            this.loading("reddit");
            reddit.login(config.username, config.password);
            this.loadingOK();

            this.loading("youtube");
            youtube = new youtube(config.yt_key);
            this.loadingOK();
        } catch (e) {
            this.loadingFail(e);
        }

        //all systems go
        this.monitor.start();
    };

    this.monitor = function() {
        this.start = function() {
            this.pms();
        }

        this.pms = function() {

        };
    }();

    this.loading = function (what) {
        process.stdout.write(chalk.bold("Loading " + what + "... "));
    };

    this.loadingOK = function () {
        process.stdout.write(chalk.green(figures.tick) + " OK!\n");
    };

    this.loadingFail = function (error) {
        process.stdout.write(chalk.red(figures.cross) + " Fail\n");
        if (error) throw error;
        else process.exit(1);
    };

    this.error = function (msg) {
        if (!config || (config && config.log.error))
            process.stdout.write(chalk.red(msg) + "\n");
    };

    this.info = function (msg) {
        if (!config || (config && config.log.info))
            process.stdout.write(chalk.blue(msg) + "\n");
    };


    this.init();
}(
    require("./nodewhal/nodewhal"),
    require("chalk"),
    require("js-yaml"),
    require("fs"),
    require("figures"),
    require("./storage"),
    require("youtube-get")
);