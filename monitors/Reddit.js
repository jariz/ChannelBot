import Monitor from './Monitor';

export default class Youtube extends Monitor {
    title = "Reddit";
    widgetProps = {
        left: '50%',
        top: '50%',
        width: '50%',
        height: '50%'
    }

    constructor({ yt }) {
        super(...arguments);

        this.yt = yt;
    }

    async start() {
        super.start();

        
    }
}