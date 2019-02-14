const assert = require('assert')
const AlwaysSampler = require('../../src/samplers/always')

describe('AlwaysSampler', function () {

    let sampler

    beforeEach(function () {
        sampler = new AlwaysSampler()
    })

    describe('sample method', function () {

        it('returns true', function () {

            const result = sampler.sample()

            assert.strictEqual(result, true)
        })
    })
})
