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

    this.backend = new backends[options.backend || 'http'](this.server);
}

SimpleRiak.prototype.getBuckets = function (callback) {
    this.backend.getBuckets(callback);
};

exports.createClient = function (options) {
    return new SimpleRiak(options);
};
