const assert = require('assert')
const FairRateSampler = require('../../src/samplers/rate_fair')

describe('FairRateSampler', function () {

    describe('sample method', function () {

        it('returns false for non-spans', function () {

            const sampler = new FairRateSampler({ rate: 20 })

            let sampledCount = 0
            let notSampledCount = 0

            doFor(200, function () {
                if (sampler.sample({})) {
                    sampledCount++
                } else {
                    notSampledCount++
                }
            })

            assert(notSampledCount > 10000)
            assert.strictEqual(sampledCount, 0)
        })

        it('returns true not more than specified rate per second per span name', function () {

            const sampler = new FairRateSampler({ rate: 20 })

            let sampledCounts = { rare_span: 0, frequent_span: 0 }
            let notSampledCount = 0

            doFor(200, function () {

                let spanName = Math.random() > 0.9
                    ? 'rare_span'
                    : 'frequent_span'

                const span = { _getOperationName: () => spanName }

                if (sampler.sample(span)) {
                    sampledCounts[spanName]++
                } else {
                    notSampledCount++
                }
            })

            assert(notSampledCount > 10000)
            assert.deepStrictEqual(sampledCounts, {
                rare_span: 4,
                frequent_span: 4,
            })
        })

        it('returns true when specified hint is true', function () {

            const sampler = new FairRateSampler({ rate: 20 })

            let sampledCounts = { rare_span: 0, frequent_span: 0 }
            let totalCount = 0

            doFor(200, function () {

                let spanName = Math.random() > 0.9
                    ? 'rare_span'
                    : 'frequent_span'

                const span = { _getOperationName: () => spanName }

                if (sampler.sample(span, true)) {
                    sampledCounts[spanName]++
                }
                totalCount++
            })

            assert(totalCount > 10000)
            assert.strictEqual(
                sampledCounts.rare_span + sampledCounts.frequent_span,
                totalCount
            )
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
