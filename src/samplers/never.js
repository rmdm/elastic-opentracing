const AlwaysSampler = require('./always')

class NeverSampler extends AlwaysSampler {

    sample () {
        return false
    }
}

module.exports = NeverSampler
