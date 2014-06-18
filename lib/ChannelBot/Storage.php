<?php
/**
 * JARIZ.PRO
 * Date: 16-6-14
 * Time: 19:43
 * Author: JariZ
 */

namespace ChannelBot;

use Hoa\File\ReadWrite;
use Hoa\File\File;

class Storage {

    /**
     * @var \Hoa\File\ReadWrite
     */
    protected $fDB;

    /**
     * @var array
     */
    protected $cache = [];

    public function __construct($file="channels.json") {
        try {
            $this->fDB = new ReadWrite($file, File::MODE_READ_WRITE);
        }
        catch (\Hoa\File\Exception\FileDoesNotExist $exception) {
            File::create($file, false);
            $this->fDB = new ReadWrite($file, File::MODE_READ_WRITE);
        }

        if($this->fDB->getSize() > 0) $this->read();
        else $this->write();
    }

    protected function read() {
        $this->fDB->seek(0);
        if(json_last_error() != 0) throw new \Exception("Unable to decode storage file: ".json_last_error_msg());
        $this->cache = json_decode($this->fDB->readAll(), TRUE);
    }

    protected function write() {
        $this->fDB->seek(0);
        $this->fDB->truncate(0);
        $data = json_encode($this->cache);
        $this->fDB->write($data, strlen($data));
    }

    public function push($item) {
        $this->cache[] = $item;
        $this->write();
    }

    public function getItems() {
        return $this->cache;
    }

    public function setItem($index, $item) {
        $this->cache[$index] = $item;
        $this->write();
    }

    public function removeItem($index) {
        unset($this->cache[$index]);

        //'rebuild' indexes
        $new = [];
        foreach($this->cache as $item) {
            if($item == null) continue;
            $new[] = $item;
        }
        $this->cache = $new;
        $this->write();
    }

//    public function __get($item) {
//        if(isset($this->cache[$item])) return null;
//        else return $this->cache[$item];
//    }
//
//    public function __set($item, $value) {
//        $this->cache[$item] = $value;
//        $this->write();
//    }

//    public function _isset($item) {
//        return isset($this->cache[$item]);
//    }
} 