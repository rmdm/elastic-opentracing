const AlwaysSampler = require('./always')

class RateSampler extends AlwaysSampler {

    constructor ({ rate }) {
        super()
        this._period = (1 / rate) * 1000
        this._lastSampledTimestamp = 0
    }

    sample (span, hint) {

        const timestamp = Date.now()

        if (
            hint === true ||
            timestamp - this._lastSampledTimestamp > this._period
        ) {
            this._lastSampledTimestamp = timestamp
            return true
        } else {
            return false
        }
    }
}

module.exports = RateSampler
