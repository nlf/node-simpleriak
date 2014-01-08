var riakpbc = require('riakpbc');

function PBC(options) {
    this.host = options.host;
    this.port = options.port || 8087;
    this.client = riakpbc.createClient({ host: this.host, port: this.port });
}

PBC.prototype.getBuckets = function (callback) {
    this.client.getBuckets(function (err, reply) {
        callback(err, reply.buckets);
    });
};

module.exports = PBC;
