import { Transport } from 'winston';
import common from 'winston/lib/winston/common';

export default class Blessed extends Transport {
    name = "blessed"
    options = {};
    
    constructor(options) {
        super(options);
        this.options = options;
        this.level = options.level || 'info';
        
        if(!options.widget) {
            throw Error("You did not provide a widget for the blessed transport to use!");
        }
        
        this.widget = options.widget;
    }
    
    log(level, message, meta, callback) {
        let out;
        if(level !== "plain") {
            out = common.log({
                ...this.options,
                level,
                message,
                meta
            });
        } else {
            out = message;
        }
        
        try {
            this.widget.add(out);
            this.widget.screen.render();
            callback(null, true);
        } catch(ex) {
            callback(ex, false);
        }
    }
}