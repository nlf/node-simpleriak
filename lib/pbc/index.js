var riakpbc = require('riakpbc');

function PBC(options) {
    this.host = options.host;
    this.port = options.port || 8087;
    this.client = riakpbc.createClient({ host: this.host, port: this.port });
}

PBC.prototype.getBuckets = function (callback) {
    this.client.getBuckets(function (err, reply) {
        if (err) {
            return callback(err);
        }

        if (reply && reply.buckets) {
            callback(null, reply.buckets);
        } else {
            callback(null, []);
        }
    });
};

PBC.prototype.getBucket = function (bucket, callback) {
    this.client.getBucket({ bucket: bucket }, function (err, reply) {
        if (err) {
            return callback(err);
        }

        callback(null, reply.props);
    });
};

PBC.prototype.setBucket = function (bucket, props, callback) {
    this.client.setBucket({ bucket: bucket, props: props }, function (err, reply) {
        if (err) {
            return callback(err);
        }

        this.client.getBucket({ bucket: bucket }, function (err, reply) {
            if (err) {
                return callback(err);
            }

            callback(null, reply.props);
        });
    }.bind(this));
};

PBC.prototype.getKeys = function (bucket, callback) {
    this.client.getKeys({ bucket: bucket }, function (err, reply) {
        if (err) {
            return callback(err);
        }

        if (reply && reply.keys) {
            callback(null, reply.keys);
        } else {
            callback(null, []);
        }
    });
};

PBC.prototype.get = function (bucket, key, params, callback) {
    var result = {
        content: []
    };
    var opts = params;
    opts.bucket = bucket;
    opts.key = key;

    this.client.get(opts, function (err, reply) {
        if (err) {
            return callback(err);
        }

        if (!Object.keys(reply).length) {
            return callback(new Error('Not found'));
        }

        result.vclock = reply.vclock.toString('base64');
        result.content = reply.content.map(function (content) {
            return {
                value: content.value,
                type: content.content_type,
                vtag: content.vtag
            };
        });

        callback(null, result);
    });
};

PBC.prototype.delete = function (bucket, key, params, callback) {
    var opts = params;
    opts.bucket = bucket;
    opts.key = key;

    this.client.del(opts, function (err, reply) {
        if (err) {
            return callback(err);
        }

        callback(null, { key: key, status: 'deleted' });
    });
};

PBC.prototype.ping = function (callback) {
    this.client.ping(function (err, reply) {
        if (err) {
            return callback(err);
        }

        callback(null, { response: 'ok' });
    });
};

PBC.prototype.status = function (callback) {
    this.client.getServerInfo(function (err, reply) {
        if (err) {
            return callback(err);
        }

        callback(null, reply);
    });
};

PBC.prototype.resources = function (callback) {
    callback(new Error('Not implemented'));
};

module.exports = PBC;
