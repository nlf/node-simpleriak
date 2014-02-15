var backends = require('./lib/backends');

function SimpleRiak(options) {
    options = options || {};
    this.defaults = {};
    this.server = {};

    if (options.bucket) {
        this.defaults.bucket = options.bucket;
    }

    this.server.host = options.host || '127.0.0.1';
    this.server.port = options.port; // we let this fall through undefined so the backend can determine its own default
    this.bucket = options.bucket;

    this.backend = new backends[options.backend || 'http'](this.server);
}

SimpleRiak.prototype.getBuckets = function (callback) {
    this.backend.getBuckets(callback);
};

SimpleRiak.prototype.getBucket = function (params, callback) {
    var bucket = params.bucket || this.bucket;
    
    if (!bucket) {
        return callback(new Error('No bucket specified'));
    }

    this.backend.getBucket(bucket, callback);
};

SimpleRiak.prototype.getKeys = function (params, callback) {
    var bucket = params.bucket || this.bucket;
    
    if (!bucket) {
        return callback(new Error('No bucket specified'));
    }

    this.backend.getKeys(bucket, callback);
};

SimpleRiak.prototype.ping = function (callback) {
    this.backend.ping(callback);
};

SimpleRiak.prototype.status = function (callback) {
    this.backend.status(callback);
};

SimpleRiak.prototype.resources = function (callback) {
    this.backend.resources(callback);
};

exports.createClient = function (options) {
    return new SimpleRiak(options);
};
