/* Builtin functions that compliment https://github.com/basho/riak_kv/blob/master/priv/mapred_builtins.js */
var builtins = module.exports = {
    /* Sorts descending by attribute given in arg */
    reduceSortByAttribute: function (v, arg) {
        return v.sort(function (a, b) { if (a[arg] > b[arg]) return -1; if (a[arg] < b[arg]) return 1; return 0; });
    },
    mapNoop: function (v) {
        return [v];
    }
};
