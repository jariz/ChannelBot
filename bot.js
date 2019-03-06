import config from './config';
import _package from './package';
import Initialize from './initialize';
import YoutubeMonitor from './monitors/Youtube';
import RedditMonitor from './monitors/Reddit';

class ChannelBot {
    log = {}; //winston
    channels = {}; //lowdb
    prefs = {}; //lowdb
    r = {}; //snoowrap 
    yt = {}; //googleapis 
    screen = {}; //blessed
    
    redditMonitor = {}
    youtubeMonitor = {}
    config = config;
    _package = _package;

    constructor() {
        this.welcome();
    }
    
    async welcome() {
        //run initialization procedure
        await Initialize.run(this);
        
        //initialize monitoring modules...
        this.youtubeMonitor = new YoutubeMonitor(this);
        this.youtubeMonitor.start();
        // this.redditMonitor = new RedditMonitor(this);
        // this.redditMonitor.start();
    }
}

export default new ChannelBot();