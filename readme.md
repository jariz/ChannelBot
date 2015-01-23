#ChannelBot
ChannelBot is a simple bot that posts the latest videos from a certain set of channels to a certain set of subreddits.
What's special about it is that **most of it's configuration goes trough reddit's PM system.**
##Setup
This guide will explain how to install ChannelBot on your own platform.
This is not necessary if you just want to add a channel to a subreddit,
If you simply want to use the publicly hosted ChannelBot by me, [check out the reddit wiki page on what commands to send.](https://reddit.com/r/ChannelBot/wiki/api)
This is a newbie-proof install guide, if you're not tech savvy, you should still be able to follow.
**If you're a advanced user, scroll down to the TL;DR version.**
Parts of the guide marked `like this` represent a command you're supposed to run from your terminal.

1. If you didn't already, install node and it's package manager, npm.
OSX: `brew install node` OR [the installer](http://nodejs.org/download/)
Linux: `apt-get install nodejs` / `pacman -S nodejs`
Windows: [Installer](http://nodejs.org/download/)
3. Make sure you have git installed.
Linux: `apt-get install git`
OSX: `brew install git`
Windows: [Installer](http://www.git-scm.com/download/win)
2. `git clone https://github.com/jariz/ChannelBot channelbot`
3. Enter the 'channelbot' directory (`cd channelbot`)
4. Install channelbot's dependencies with `npm install`
5. Rename config.default.yaml to config.yaml (on linux/osx: `mv config.default.yaml config.yaml`, on windows, the same, just replace 'mv' with 'move')
6. Edit the file (osx/linux: `nano config.yaml`, windows: `notepad config.yaml`)
The lines you want to change will be the first 3 lines. First 2 are your account settings, those speak for themselves.
Third line is your API key, you can get one at [Google's Developer Console](http://console.developers.google.com/).
Make sure to add [your IP](http://wtfismyip.com) to the 'allowed IP's' on the credential page where your API key will be shown.
6. Start the bot, check if it completes all four parts of the bootup proccess. (should say OK! 4 times)
7. If you check it and all seems fine, use forever to make the bot run as a system daemon:
`forever start bot.js`
The bot will now always run in the background, even if the system gets rebooted.  
If you want to read it's output, you can at the log location forever tells you upon adding the bot.

###TL;DR

```
apt-get install nodejs git
git clone https://github.com/jariz/ChannelBot channelbot
cd channelbot
npm install
mv config.default.yaml config.yaml
nano config.yaml
sudo npm install -g forever
forever start bot.js
```