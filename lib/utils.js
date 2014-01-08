exports.parseJson = function (input) {
    var result;

    try {
        result = JSON.parse(input);
    } catch (e) {
        result = e;
    }

    return result;
};
