const AlwaysSampler = require('./always')
const RateSampler = require('./rate')
const is = require('../util/is')

class FairRateSampler extends AlwaysSampler {

    constructor ({ rate }) {
        super()
        this._rate = rate
        this._samplers = {}
    }

    sample (span, hint) {

        const group = this._group(span)

        if (!group) {
            return false
        }

        if (!this._samplers[group]) {
            this._samplers[group] = new RateSampler({ rate: this._rate })
        }

        return this._samplers[group].sample(span, hint)
    }

    _group (span) {

        if (!span || !is.function(span._getOperationName)) {
            return null
        }

        return span._getOperationName()
    }
}

module.exports = FairRateSampler
