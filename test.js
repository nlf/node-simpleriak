var client = require('./').createClient({ backend: 'http' });

client.getBuckets(function (err, buckets) {
    console.log(buckets);
    process.exit(0);
});
