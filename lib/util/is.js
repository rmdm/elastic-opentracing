const is = {

    object (obj) {
        return typeof obj === 'object' && obj !== null
    },

    function (fun) {
        return typeof fun === 'function'
    },

    number (num) {
        return typeof num === 'number'
    },

    string (srt) {
        return typeof srt === 'string'
    },

    array (arr) {
        return Array.isArray(arr)
    },

    own (obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop)
    },
}

module.exports = is
