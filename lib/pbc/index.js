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

        if (reply && reply.props) {
            callback(null, reply.props);
        } else {
            callback(null, {});
        }
    });
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
