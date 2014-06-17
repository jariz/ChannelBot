<?php
/**
 * JARIZ.PRO
 * Date: 16-6-14
 * Time: 17:43
 * Author: JariZ
 */
namespace ChannelBot;

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
        $this->log($msg, "white");
    }

    public function info($msg) {
        $this->log($msg, "cyan");
    }

    public function error($msg) {
        $this->log($msg, "light_red");
    }

    protected function existsAlready($subreddit, $channel=null, $channel_id=null) {
        foreach($this->channels->getItems() as $item) {
            $isSub = $subreddit == isset($item["subreddit"]) && $subreddit == $item["subreddit"];
            if(isset($item["channel_id"]) && !is_null($channel_id) && strtolower($channel_id) == strtolower($item["channel_id"]) && $isSub) return true;
            if(isset($item["channel"]) && !is_null($channel) && strtolower($channel) == strtolower($item["channel"]) && $isSub) return true;
        }
        return false;
    }

    protected function log($msg, $foreground=null, $background=null) {
        if($this->colors == null) $this->colors = new Colors();
        echo $this->colors->getColoredString($msg, $foreground, $background)."\n";
    }

    protected function Monitor() {
        while(true) {
            $start = microtime(true);
            $this->readPMs();
            $this->monitorChannels();
            $this->wait($start);
        }
    }

    public function monitorChannels() {
        foreach($this->channels->getItems() as $channel) {

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

    /**
     * Reads and processes the PMs
     */
    protected function readPMs() {
        $messages = $this->reddit->getComments("message/unread", 100);
        foreach($messages as $message) {
            /* @var $message \RedditApiClient\Comment */
            try {
                $config = (object)Yaml::parse($message->getBody(), true, false);

                //validate existence of required fields
                if(!isset($config->subreddit)) throw new \InvalidArgumentException("Required field 'subreddit' missing");
                if(!isset($config->channel) && !isset($config->channel_id)) throw new \InvalidArgumentException("Please specify either 'channel' or 'channel_id'");

                //validate subreddit
                $validator = (new Validator())
                    ->string()
                    ->notEmpty()
                    ->noWhitespace()
                    ->alnum("_")
                    ->setName("'subreddit'");

                $validator->assert($config->subreddit);

                if(isset($config->channel)) {
                    //validate channel
                    $validator = (new Validator())
                        ->string()
                        ->notEmpty()
                        ->noWhitespace()
                        ->alnum()
                        ->setName("'channel'");

                    $validator->assert($config->channel);
                } else {
                    //validate channel_id
                    $validator = (new Validator())
                        ->string()
                        ->notEmpty()
                        ->noWhitespace()
                        ->alnum("_")
                        ->length(24, 24)
                        ->setName("'channel_id'");

                    $validator->assert($config->channel_id);
                }

                //do exist check
                if($this->existsAlready($config->subreddit, !isset($config->channel) ? null : $config->channel, !isset($config->channel_id) ? null : $config->channel_id))
                    throw new ExistsAlreadyException("This channel/subreddit combination already exists.");

                //do mod check
                if(!$this->isMod($message->getAuthorName(), $config->subreddit))
                    throw new NotAModException("You're either not a mod, or your account doesn't have all permissions on this subreddit.");

                //do yt check
                if(isset($config->channel)) {
                    $data = $this->youtube->getChannelByName($config->channel);
                } else {
                    $data = $this->youtube->getChannelById($config->channel_id);
                }

                if(!$data)  throw new InvalidChannelException("This channel doesn't exist.");
                $config->channel_id = $data->id;
                if(!isset($data->contentDetails->relatedPlaylists->uploads)) throw new InvalidChannelException("Channel was found, but unable to access the uploaded videos of the channel.");
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

    protected function loadDb() {
        $this->channels = new Storage($this->rootDir."/channels.json");
    }

    protected function loadConfig() {
        $config = new Read($this->rootDir."/config.yaml");
        $this->config = (object)Yaml::parse($config->readAll());
    }
}