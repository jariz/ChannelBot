var fs = require('fs');

var Storage = function(file) {
    if(!file) file = "channels.json";

    var cache = [];

    var read = function() {
        if(!fs.existsSync(file)) return; //file doesn't exist, let write take care of it once it's called

        var data = fs.readFileSync(file, 'utf-8');
        cache = JSON.parse(data);
    };

    var write = function() {
        fs.writeFile(file, JSON.stringify(cache));
    };

    this.push = function(item) {
        cache.push(item);
        write();
    };

    this.remove = function(index) {
        cache = cache.map
    };

    this.set = function(index, item) {
        cache[index] = item;
        write();
    };

    this.get = function(index) {
        return cache[index];
    };

    read();

    return this;
};

module.exports = Storage;