function encode (str) {
    return Buffer.from(str, 'utf8').toString('base64')
}

function decode (base64str) {
    return Buffer.from(base64str, 'base64').toString('utf8')
}

module.exports = { encode, decode }
