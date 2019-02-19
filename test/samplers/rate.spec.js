const assert = require('assert')
const RateSampler = require('../../lib/samplers/rate')

describe('RateSampler', function () {

    describe('sample method', function () {

        it('returns true not more than specified rate per second', function () {

            const sampler = new RateSampler({ rate: 20 })

            let sampledCount = 0
            let notSampledCount = 0

            doFor(200, function () {
                if (sampler.sample()) {
                    sampledCount++
                } else {
                    notSampledCount++
                }
            })

            assert(notSampledCount > 10000)
            assert.strictEqual(sampledCount, 4)
        })

        it('returns true when passed hint is true', function () {

            const sampler = new RateSampler({ rate: 20 })

            let sampledCount = 0
            let totalCount = 0

            doFor(200, function () {
                if (sampler.sample({}, true)) {
                    sampledCount++
                }
                totalCount++
            })

            assert(totalCount > 10000)
            assert.strictEqual(sampledCount, totalCount)
        })
    })
})

function doFor (ms, fn) {

    const start = Date.now()
    const end = start + ms

    while (Date.now() < end) {
        fn()
    }
}
