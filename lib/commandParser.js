var commandParser = (function () {
    return {
        'parseFTPCommand': function (data) {
            var m = (data + '').match(/\s*(\S*)(\s+(.*\S))?\s*/);
            var returnData;
            if (!m) returnData = { cmd: '', arg: '' };
            else returnData = { cmd: m[1], arg: m[3] };
            return returnData;
        }
    };
})();

exports = module.exports = commandParser; 