import { log, progressbar } from 'blessed';
import BlessedTransport from '../transports/Blessed';
import config from '../config';
import Winston from 'winston';

export default class Monitor {
    constructor({screen}) {
        this.screen = screen;
    }
    
    start() {
        //initialize log widget
        const logWidget = new log({
            border: {
                type: 'line'
            },
            label: `${this.title} Monitor`,
            mouse: true,
            ...this.logProps
        });
        this.screen.append(logWidget);

        //initialize logger that redirects output to widget
        this.log = new Winston.Logger({
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
        this.log.add(BlessedTransport, {
            level: config.level ? config.level : "debug",
            colorize: true,
            prettyPrint: true,
            widget: logWidget
        });
        
        //initialize progressbar widget
        const progressBarWidget = progressbar({
            border: 'line',
            style: {
                fg: 'red',
                bg: 'default',
                bar: {
                    bg: 'default',
                    fg: 'red'
                },
                border: {
                    fg: 'default',
                    bg: 'default'
                }
            },
            ch: '|',
            filled: 50,
            ...this.progressBarProps
        });
        this.progressBar = progressBarWidget;
        this.screen.append(progressBarWidget);
    }
}