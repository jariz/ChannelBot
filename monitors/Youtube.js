import Monitor from './Monitor';
import Queue from 'async/queue';
import config from '../config';

export default class Youtube extends Monitor {
    title = "Youtube";
    logProps = {
        left: '50%',
        top: '0',
        width: '50%',
        height: '80%'
    }
    progressBarProps = {
        left: '50%',
        top: '80%',
        width: '50%',
        height: 3
    }
    queue = []

    constructor({ yt, r, channels, prefs}) {
        super(...arguments);
        
        this.yt = yt;
        this.r = r;
        this.channels = channels;
        this.prefs = prefs;
    }
    
    totalWork = 0;

    queue = {}
    
    async start() {
        super.start();
        
        try {
            this.log.debug("Initializing queue...");
            this.queue = Queue((...args) => this.worker(...args), config.concurrency);
        }
        catch(e) {
            this.log.error(e);
        }
        
        this.queue.drain = () => this.process();
        this.queue.error = (err) => this.log.error("An error occurred while processing an item in the queue", err);
        this.process();
    }
    
    async process() {
        const work = this.getWork();
        this.totalWork = work;
        //todo: at some point, it'd be nice if we could manipulate queue while it's still running
        this.log.debug(`Restarting queue with ${this.totalWork.length} items.`);
        this.queue.push(work);
    }
    
    /**
     * Gets all channels from DB, aka, the 'work'
     */
    getWork() {
        return this.channels.value();
    }
    
    async strikeChannel(channel) {
        channel.strikes = channel.strikes ? channel.strikes + 1 : 1;
        
        if(channel.strikes > config.striking.maxStrikes) {
            //yerrrr out!
            this.channels.filter(currChannel => currChannel.channel_id === channel.channel_id ? channel : currChannel).value();
            this.log.warn(`Channel ${channel.channel} generated too many strikes (aka, errors) and was removed.`);

            if(config.striking.pmUser) {
                const to = config.production ? channel.user : config.testing.testUser;
                const text = config.striking.messageTemplate
                    .replace(/\(\(channel\)\)/g, channel.channel)
                    .replace(/\(\(subreddit\)\)/, channel.subreddit)
                    .replace(/\(\(maxStrikes\)\)/, config.striking.maxStrikes)
                    .replace(/\(\(hours\)\)/, Math.round(config.striking.strikesExpiration / 60 / 60));
                try {
                    await this.r.composeMessage({
                        to,
                        text,
                        subject: "Your channel was removed."
                    });
                    this.log.info("Submitted PM reporting the removal to " + to);
                } catch(ex) {
                    this.log.error(`Error submitting report of removal because of striking limit to user "${to}"`, ex)
                }
            }
            return;
        }
        
        channel.last_strike_update = Math.round((new Date()).getTime() / 1000);
        this.updateChannel(channel);
    }
    
    updateChannel(channel) {
        this.channels.map(currChannel => currChannel.channel_id === channel.channel_id ? channel : currChannel).value();
    }

    /**
     * Processes a single item in the queue (aka, a channel)
     */
    worker(channel, callback) {
        const perc = Math.round((this.totalWork.length - this.queue.length()) / this.totalWork.length * 100);
        this.progressBar.setProgress(perc);
        this.progressBar.setLabel(`${this.queue.running()} workers running / ${this.queue.length()} channels left out of ${this.totalWork.length}`);
        this.screen.render();
        
        //check if channel is striked
        if(channel.strikes) {
            //check if strike is expired
            const now = Math.round((new Date()).getTime() / 1000);
            if(now > (channel.last_strike_update + config.striking.strikesExpiration)) {
                //reset strikes
                delete channel.last_strike_update;
                delete channel.strikes;
                this.updateChannel(channel);
                this.log.info(`Removed strikes from channel ${channel.channel}. (time expired)`);
            }
        }
        
        this.yt.playlistItems.list({
            part: 'snippet',
            playlistId: channel.upload_playlist,
            // playlistId: "lel",
            maxResults: 1
        }, async (error, response) => {
            if(error) {
                this.strikeChannel(channel);
                callback(error);
                return;
            }
            
            try {
                if(!("items" in response) && response.items.length == 0) {
                    throw new Error(`This channel (${channel.channel}) playlist did not contain any videos`);
                }
                
                const { items } = response;
                for (let video of items) {
                    const { videoId } = video.snippet.resourceId;
                    if (!channel.last_videos.find(lastVid => lastVid === videoId)) {
                        this.log.info(`Submitting "${video.snippet.title}" to /r/${channel.subreddit}`);
                        // await this.r.submitLink({
                        //     subredditName: config.production ? channel.subreddit : config.testing.testSubreddit,
                        //     title: video.snippet.title,
                        //     url: config.prepend + videoId
                        // });
                        this.log.debug(`Submitted ${video.snippet.title}" to /r/${channel.subreddit}`);
                        channel.last_videos = [
                            ...channel.last_videos,
                            videoId
                        ];
                        this.updateChannel(channel);
                    }
                }
                
                callback();
            } catch (ex) {
                this.strikeChannel(channel);
                callback(ex);
            }
        });
    }
}