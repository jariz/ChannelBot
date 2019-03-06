import Winston from 'winston';
import SnooWrap from 'snoowrap';
import Chalk from 'chalk';
import Figures from 'figures';
import LowDB from 'lowdb';
import { screen, log } from 'blessed';
import Asciify from 'asciify';

import Google from 'googleapis';

import config from './config';
import _package from './package';
import BlessedTransport from './transports/Blessed';

const { stdout } = process;

class Initialize {
    async run(owner) {
        this.owner = owner;

        //initialize UI before everything else
        try {
            this.initUI();
        } catch (ex) {
            //silently fail if destroy fails...
            try {
                this.owner.screen.destroy();
                //eslint-disable-next-line
            } catch (x) {
            }

            stdout.write("Unable to initialize ChannelBot UI:\r\n" + Chalk.red(ex));
            return;
        }

        const logo = await new Promise((resolve, reject) => Asciify('ChannelBot', { font: 'doom' }, (err, res) => err ? reject(err) : resolve(res)));
        this.owner.log.plain(Chalk.blue(logo));
        this.owner.log.plain(Chalk.white(`ChannelBot-NEXT ${_package.version}\r\n`));
        if(typeof Proxy !== "function") {
            throw new Error("ChannelBot-NEXT requires proxy support to be enabled. Install either node 6 or run node with --harmony_proxies");
        } 
        this.owner.log.plain("\r\n");

        try {
            await this.initializing("channels database", this.initChannels, true);
            await this.initializing("preferences database", this.initPrefs, true);
            await this.initializing("reddit", this.initReddit);
            await this.initializing("youtube", this.initYoutube, true);
        }
        catch (exception) {
            // this.owner.log ? this.owner.log.error(exception) : console.error(exception);
            console.error(exception);
        }

        this.owner.log.debug("Test!");
    }

    async initializing(description, func, isSync) {
        try {
            this.owner.log.plain(`Initializing ${description}...`);
            let retVal;
            if (!isSync) {
                retVal = await func.bind(this)();
            } else {
                retVal = func.bind(this)();
            }
            this.owner.log.plain(Chalk.green(`${Figures.tick} successful!`));
            this.owner.log.plain();
            return retVal;
        }
        catch (exception) {
            this.owner.log.plain(Chalk.red(`${Figures.cross} failed!`));
            this.owner.log.plain();
            throw exception;
        }
    }

    async initReddit() {
        this.owner.r = new SnooWrap({
            userAgent: `ChannelBot ${_package.version} (by /u/MoederPoeder)`,
            ...config.reddit
        });
        //snoowrap doesn't actually log in until needed, which is fine, but we want to test if the login is correct, so do a subredit fetch.
        // await this.owner.r.getSubreddit("channelbot").fetch();
    }

    initChannels() {
        this.owner.channels = new LowDB("./channels.json");
        this.owner.channels.defaults([]).value();
    }

    initPrefs() {
        this.owner.prefs = new LowDB("./preferences.json");
        this.owner.prefs
            .defaults({
                strikes: []
            })
            .value();
    }

    initYoutube() {
        Google.options({ auth: config.youtube.key });
        this.owner.yt = Google.youtube("v3");
    }

    initUI() {
        //initialize blessed (UI system)
        this.owner.screen = new screen({
            title: `ChannelBot-NEXT ${_package.version}`,
            smartCSR: true,
            sendFocus: true,
            cursor: {
                artificial: true
            },
            dockBorders: true
        });
        const coreWidget = new log({
            top: '0',
            left: '0',
            width: '50%',
            height: '100%',
            border: {
                type: 'line'
            },
            label: 'Core'
        });
        this.owner.screen.append(coreWidget);

        this.owner.screen.key(['C-c', 'escape', 'q'], () => process.exit(0));

        //initialize winston (logging system)
        this.owner.log = new Winston.Logger({
            levels: {
                debug: 5,
                info: 4,
                plain: 3,
                warn: 2,
                error: 1
            },
            colors: {
                debug: 'green',
                info: 'blue',
                warn: 'yellow',
                error: 'red'
            }
        });
        this.owner.log.add(BlessedTransport, {
            level: this.owner.config.level ? this.owner.config.level : "debug",
            colorize: true,
            prettyPrint: true,
            widget: coreWidget
        });

        this.owner.screen.render();
    }
}

export default new Initialize();