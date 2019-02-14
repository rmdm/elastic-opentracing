const crypto = require('crypto')

function randomId (nBytes) {
    return crypto.randomBytes(nBytes).toString('hex')
}

module.exports = randomId
