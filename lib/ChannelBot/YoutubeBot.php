<?php
/**
 * JARIZ.PRO
 * Date: 16-6-14
 * Time: 17:43
 * Author: JariZ
 */
namespace ChannelBot;

use ChannelBot\Exceptions\ActionNotSupportedException;
use ChannelBot\Exceptions\ExistenceException;
use ChannelBot\Exceptions\ExistsAlreadyException;
use ChannelBot\Exceptions\InvalidChannelException;
use ChannelBot\Exceptions\NotAModException;
use Hoa\File\File;
use Hoa\File\Read;
use Madcoda\Youtube;
use RedditApiClient\Reddit;
use Respect\Validation\Validator;
use Symfony\Component\Yaml\Yaml;

class YoutubeBot {

    /**
     * The bot's config found in config.yaml
     * @var object
     */
    protected $config;

    /**
     * @var Storage The channels and their metadata
     */
    protected $channels;

    /**
     * The channels db
     * @var array
     */
    protected $db = [];

    /**
     * @var string The project directory
     */
    protected $rootDir;

    /**
     * @var Reddit
     */
    protected $reddit;

    /**
     * @var Youtube
     */
    protected $youtube;

    /**
     * @var Colors
     */
    protected $colors;

    /**
     * @param $rootDir string The project directory
     */
    public function bootstrap($rootDir) {
        $this->rootDir = $rootDir;
        $this->plain(base64_decode("PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09DQo9PT0gICAgID09PSAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICA9PSAgICAgID09PT09PT09PT09PT09PT0NCj09ICA9PT0gID09ICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gID09ICA9PT0gID09PT09PT09PT09PT09PQ0KPSAgPT09PT09PT0gID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAgPT0gID09PT0gID09PT09PT09PT0gID09DQo9ICA9PT09PT09PSAgPT09PT09ICAgPT09ICA9ID09PSAgPSA9PT09ICAgPT09ICA9PSAgPT09ICA9PT09ICAgPT09ICAgID0NCj0gID09PT09PT09ICAgID09PSAgPSAgPT0gICAgID09ICAgICA9PSAgPSAgPT0gID09ICAgICAgPT09PSAgICAgPT09ICA9PQ0KPSAgPT09PT09PT0gID0gID09PT09ICA9PSAgPSAgPT0gID0gID09ICAgICA9PSAgPT0gID09PSAgPT09ICA9ICA9PT0gID09DQo9ICA9PT09PT09PSAgPSAgPT09ICAgID09ICA9ICA9PSAgPSAgPT0gID09PT09ICA9PSAgPT09PSAgPT0gID0gID09PSAgPT0NCj09ICA9PT0gID09ICA9ICA9PSAgPSAgPT0gID0gID09ICA9ICA9PSAgPSAgPT0gID09ICA9PT0gID09PSAgPSAgPT09ICA9PQ0KPT09ICAgICA9PT0gID0gID09PSAgICA9PSAgPSAgPT0gID0gID09PSAgID09PSAgPT0gICAgICA9PT09PSAgID09PT0gICA9DQo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0="));

        //step 1
        $this->info("Loading config...");
        $this->loadConfig();

        //step 2
        $this->info("Loading database...");
        $this->loadDb();

        //step 3
        $this->info("Initializing Reddit...");
        $this->reddit = new Reddit(
            $this->config->username,
            $this->config->password
        );

        //step 4
        $this->info("Initializing Youtube...");
        $this->youtube = new Youtube(array(
            "key" => $this->config->yt_key
        ));

        //boom
        $this->Monitor();
    }

    public function plain($msg) {
        if(!isset($this->config->log) || (isset($this->config->log) && in_array("plain", $this->config->log))) $this->log($msg, "white");
    }

    public function info($msg) {
        if(!isset($this->config->log) || (isset($this->config->log) && in_array("info", $this->config->log))) $this->log($msg, "cyan");
    }

    public function error($msg) {
        if(!isset($this->config->log) || (isset($this->config->log) && in_array("error", $this->config->log))) $this->log($msg, "light_red");
    }

    public function debug($msg) {
        if(!isset($this->config->log) || (isset($this->config->log) && in_array("debug", $this->config->log))) $this->log($msg, "light_green");
    }

    protected function existsAlready($subreddit, $channel=null, $channel_id=null) {
        return $this->getChannelIndex($subreddit, $channel, $channel_id) !== false;
    }

    protected function getChannelIndex($subreddit, $channel=null, $channel_id=null) {
        foreach($this->channels->getItems() as $index => $item) {
            $isSub = isset($item["subreddit"]) && strtolower($item["subreddit"]) && strtolower($subreddit);
            if(isset($item["channel_id"]) && !is_null($channel_id) && strtolower($channel_id) == strtolower($item["channel_id"]) && $isSub) return $index;
            if(isset($item["channel"]) && !is_null($channel) && strtolower($channel) == strtolower($item["channel"]) && $isSub) return $index;
        }
        return false;
    }

    protected function log($msg, $foreground=null, $background=null) {
        if($this->colors == null) $this->colors = new Colors();
        echo $this->colors->getColoredString($msg, $foreground, $background)."\n";
    }

    protected function Monitor() {
        $run = 0;
        while(true) {
            try {
                $run++;
                $start = microtime(true);

                //get and process new PMs
                $this->readPMs();

                //don't wanna stress the YT api too much
                if($run == 5) {
                    $this->monitorChannels();
                    $run = 0;
                }
                $this->wait($start);
            }
            catch(\Exception $e) {
                $this->error("Error in monitor loop: {$e->getMessage()}. Restarting loop.");
            }
        }
    }

    public function monitorChannels() {
        foreach ($this->channels->getItems() as $index => $channel) {
            try {
                $API_URL = $this->youtube->getApi('playlistItems.list');
                $params = array(
                    'playlistId' => $channel["upload_playlist"],
                    'part' => 'id, snippet, contentDetails, status',
                    'maxResults' => 1
                );
                $apiData = $this->youtube->api_get($API_URL, $params);
                $items = $this->youtube->decodeList($apiData);
                if (!isset($items[0])) throw new ExistenceException("Youtube returned a empty array...?");
                $item = $items[0];

                //convert from old format to new?
                if(isset($channel["last_video"])) {
                    $channel["last_videos"] = [ $channel["last_video"] ];
                    unset($channel["last_video"]);
                }

                //first run?
                if (!isset($channel["last_videos"]))
                    $channel["last_videos"] = [$item->contentDetails->videoId];

                if (!in_array($item->contentDetails->videoId, $channel["last_videos"])) {
                    //we've got one!
                    $success = $this->reddit->submit(
                        $channel["subreddit"],
                        "link",
                        $item->snippet->title,
                        $this->config->prepend . $item->contentDetails->videoId
                    );

                    if ($success) $this->info("Submitted \"{$item->snippet->title}\" from {$channel['channel']} to /r/{$channel['subreddit']}");
                    else $this->error("Failed submitting \"{$item->snippet->title}\" from {$channel['channel']} to /r/{$channel['subreddit']}");

                    //update last video
                    $channel["last_videos"][] = $item->contentDetails->videoId;
                }

                $channel["last_check"] = time();
            } catch (\Exception $e) {
                $this->error("Error while getting playlist {$channel['upload_playlist']} for channel {$channel['channel_id']} to /r/{$channel['subreddit']}:\n{$e->getMessage()}");
            }

            $this->channels->setItem($index, $channel);
        }
    }

    public function wait($start) {
        $spend = 2000 - (microtime(true) - $start);
        if ($spend > 0) {
            $spend = ($spend * 1000);
            usleep($spend);
        }
    }

    protected function isMod($user, $subreddit) {
        $data = (object)$this->reddit->sendRequest("GET", "http://www.reddit.com/r/{$subreddit}/about/moderators.json");
        if(!isset($data->data)) return false;
        $mods = $data->data["children"];
        $found = false;
        foreach($mods as $mod) {
            if(strtolower($mod["name"]) == strtolower($user)) {
                //ok he's part of the team, but is he a 'all' mod?
                if(in_array("all", $mod["mod_permissions"])) {
                    $found = true;
                    break;
                }
            }
        }
        return $found;
    }

    function validate($value, $field) {
        $validator = new Validator();
        switch($field) {
            case "channel_id":
                $validator = $validator
                    ->string()
                    ->notEmpty()
                    ->noWhitespace()
                    ->alnum("_-")
                    ->length(24, 24)
                    ->setName("'channel_id'");
                break;
            case "channel":
                $validator = $validator
                    ->string()
                    ->notEmpty()
                    ->noWhitespace()
                    ->alnum()
                    ->setName("'channel'");
                break;
            case "subreddit":
                $validator = $validator
                    ->string()
                    ->notEmpty()
                    ->noWhitespace()
                    ->alnum("_")
                    ->setName("'subreddit'");
                break;
        }
        $validator->assert($value);
    }

    /**
     * Reads and processes the PMs
     */
    protected function readPMs() {
        $messages = $this->reddit->getComments("message/unread", 100);
        foreach($messages as $message) {
            /* @var $message \RedditApiClient\Comment */
            try {
                if($message->offsetGet("was_comment")) {
                    $this->debug("Ignored a comment reply from {$message->getAuthorName()}");
                    //mark as read
                    $this->reddit->sendRequest("POST", "http://www.reddit.com/api/read_message", array("id" => $message->getThingId(), "uh" => $this->reddit->modHash));
                    break;
                }
                $this->debug("Received a message!\n------------\n{$message->getBody()}\n------------");
                $this->debug("Processing message...");
                $this->debug("- Action: {$message->offsetGet("subject")}");
                $this->debug("- Parsing message...");
                $config = (object)Yaml::parse($message->getBody(), true, false);

                switch ($subject = strtolower($message->offsetGet("subject"))) {
                    case "list":
                        //validate existence of required fields
                        $this->debug("- Checking required fields...");
                        if (!isset($config->subreddit)) throw new \InvalidArgumentException("Required field 'subreddit' missing");

                        //validate subreddit
                        $this->debug("- Validating fields...");
                        $this->validate($config->subreddit, "subreddit");

                        //do mod check
                        $this->debug("- Checking if {$message->getAuthorName()} is mod of {$config->subreddit}...");
                        if (!$this->isMod($message->getAuthorName(), $config->subreddit))
                            throw new NotAModException("You're either not a mod, or your account doesn't have all permissions on this subreddit.");

                        //all checks done, let the magic begin
                        $reply = "Channel|Channel ID|Time added to CB|User who added it to CB|Last check by CB\n:---|:---|:---|:---|:---|\n";
                        $hits = 0;
                        foreach($this->channels->getItems() as $channel) {
                            $channel = (object)$channel;
                            if(strtolower($channel->subreddit) == strtolower($config->subreddit)) {
                                $hits++;
                                $added = (new \TimeAgo())->inWords(date("Y-m-d H:i:s", $channel->register_date));
                                $lastcheck = round(time() - $channel->last_check);
                                $reply .= "{$channel->channel}|{$channel->channel_id}|{$added} ago|{$channel->user}|{$lastcheck} seconds ago\n";
                            }
                        }
                        if($hits == 0) {
                            $reply = "Sorry, nothing found for that subreddit in particular. Perhaps [add some channels to it](http://www.reddit.com/r/ChannelBot/wiki/api)?";
                        }
                        $this->debug($reply);
                        $this->reddit->sendRequest("POST", "http://www.reddit.com/api/compose", array(
                            "api_type" => "json",
                            "subject" => "Results",
                            "text" => $reply,
                            "to" => $message->getAuthorName(),
                            "uh" => $this->reddit->modHash
                        ));
                        break;
                    case "add":

                        //validate existence of required fields
                        $this->debug("- Checking required fields...");
                        if (!isset($config->subreddit)) throw new \InvalidArgumentException("Required field 'subreddit' missing");
                        if (!isset($config->channel) && !isset($config->channel_id)) throw new \InvalidArgumentException("Please specify either 'channel' or 'channel_id'");

                        $this->debug("- Validating fields...");

                        //validate subreddit
                        $this->validate($config->subreddit, "subreddit");

                        if (isset($config->channel)) {
                            //validate channel
                            $this->validate($config->channel, "channel");
                        } else {
                            //validate channel_id
                            $this->validate($config->channel_id, "channel_id");
                        }

                        //do exist check
                        $this->debug("- Checking if channel/subredit combination already exists...");
                        if ($this->existsAlready($config->subreddit, !isset($config->channel) ? null : $config->channel, !isset($config->channel_id) ? null : $config->channel_id))
                            throw new ExistenceException("This channel/subreddit combination already exists.");

                        //do mod check
                        $this->debug("- Checking if {$message->getAuthorName()} is mod of {$config->subreddit}...");
                        if (!$this->isMod($message->getAuthorName(), $config->subreddit))
                            throw new NotAModException("You're either not a mod, or your account doesn't have all permissions on this subreddit.");

                        //do yt check
                        $this->debug("- Retrieving and processing channel data from YT API...");
                        $data = $this->getChannel(!isset($config->channel) ? $config->channel_id : $config->channel, isset($config->channel_id));

                        if (!$data) throw new InvalidChannelException("This channel doesn't exist.");
                        $config->channel_id = $data->id;
                        $config->channel = $data->snippet->title;
                        if (!isset($data->contentDetails->relatedPlaylists->uploads)) throw new InvalidChannelException("Channel was found, but unable to access the uploaded videos of the channel.");
                        $config->upload_playlist = $data->contentDetails->relatedPlaylists->uploads;

                        $reply = "Successfully added channel {$data->snippet->title}. It will now be monitored and new entries will be posted to /r/{$config->subreddit}.";

                        $this->channels->push([
                            "channel" => isset($config->channel) ? $config->channel : null,
                            "channel_id" => isset($config->channel_id) ? $config->channel_id : null,
                            "subreddit" => $config->subreddit,
                            "user" => $message->getAuthorName(),
                            "register_date" => time(),
                            "upload_playlist" => $config->upload_playlist
                        ]);

                        //tell console & user
                        $this->info($reply);
                        $this->reddit->sendRequest("POST", "http://www.reddit.com/api/compose", array(
                            "api_type" => "json",
                            "subject" => "Success!",
                            "text" => $reply,
                            "to" => $message->getAuthorName(),
                            "uh" => $this->reddit->modHash
                        ));
                        break;
                    case "remove":
                        //validate existence of required fields
                        $this->debug("- Checking required fields...");
                        if (!isset($config->subreddit)) throw new \InvalidArgumentException("Required field 'subreddit' missing");
                        if (!isset($config->channel) && !isset($config->channel_id)) throw new \InvalidArgumentException("Please specify either 'channel' or 'channel_id'");

                        $this->debug("- Validating fields...");

                        //validate subreddit
                        $this->validate($config->subreddit, "subreddit");

                        //validate channel (id)
                        if(!isset($config->channel_id)) {
                            $this->validate($config->channel, "channel");

                            $youtube = $this->youtube->getChannelByName($config->channel);
                            if(!$youtube) throw new InvalidChannelException("This channel doesn't exist");
                            $config->channel_id = $youtube->id;
                            $config->channel = $youtube->snippet->title;
                        } else {
                            $this->validate($config->channel_id, "channel_id");
                        }

                        //do exist check
                        $this->debug("- Checking if channel/subredit combination already exists...");
                        if (!$this->existsAlready($config->subreddit, null, $config->channel_id))
                            throw new ExistenceException("This channel/subreddit combination doesn't exist.");

                        //do mod check
                        $this->debug("- Checking if {$message->getAuthorName()} is mod of {$config->subreddit}...");
                        if (!$this->isMod($message->getAuthorName(), $config->subreddit))
                            throw new NotAModException("You're either not a mod, or your account doesn't have all permissions on this subreddit.");

                        //ok, all checks done, remove it
                        $this->channels->removeItem($this->getChannelIndex($config->subreddit, null, $config->channel_id));

                        $reply = "The channel with id '{$config->channel_id}', subreddit: {$config->subreddit} has been removed from the database.";

                        //tell console & user
                        $this->info($reply);
                        $this->reddit->sendRequest("POST", "http://www.reddit.com/api/compose", array(
                            "api_type" => "json",
                            "subject" => "Success!",
                            "text" => $reply,
                            "to" => $message->getAuthorName(),
                            "uh" => $this->reddit->modHash
                        ));
                        break;
                    default:
                        if(strpos($subject, "approved submitter") === false)
                            throw new ActionNotSupportedException("Invalid subject. Subject needs to be one of the following:\n'add' OR 'remove'.");
                }


            } catch(\Exception $e) {
                $msg = method_exists($e, "getFullMessage") ? $e->getFullMessage() : $e->getMessage();
                $x = explode("\n", $msg);
                $emsg = "";
                foreach($x as $m) $emsg .= "```\r\n{$m}\r\n```\r\n\r\n";

                //throw error to console
                if(method_exists($e, "getFullMessage"))
                    $this->error(get_class($e).": ".$e->getFullMessage());
                else $this->error(get_class($e).": ".$e->getMessage());

                //message user the bad news
                $this->reddit->sendRequest("POST", "http://www.reddit.com/api/compose", array(
                    "api_type" => "json",
                    "subject" => get_class($e),
                    "text" => $emsg,
                    "to" => $message->getAuthorName(),
                    "uh" => $this->reddit->modHash
                ));
            }

            //mark as read
            $this->reddit->sendRequest("POST", "http://www.reddit.com/api/read_message", array("id" => $message->getThingId(), "uh" => $this->reddit->modHash));
        }
    }

    /**
     * Because the normal getChannelByName/Id functions appear to make youtube give 500's,
     * I've got my own wrapper of those functions here.
     * @param $channel string The channel name/id
     * @param $isId boolean Is the first parameter a channel id?
     *
     */
    protected function getChannel($channel, $isId) {
        $API_URL = $this->youtube->getApi('channels.list');
        $params = [
            'part' => 'id,snippet,contentDetails',
        ];
        if($isId) $params["id"] = $channel;
        else $params["forUsername"] = $channel;
        $apiData = $this->youtube->api_get($API_URL, $params);
        return $this->youtube->decodeSingle($apiData);
    }

    protected function loadDb() {
        $this->channels = new Storage($this->rootDir."/channels.json");
    }

    protected function loadConfig() {
        $config = new Read($this->rootDir."/config.yaml");
        $this->config = (object)Yaml::parse($config->readAll());
    }
}