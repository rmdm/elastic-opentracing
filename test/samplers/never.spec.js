const assert = require('assert')
const NeverSampler = require('../../src/samplers/never')

describe('NeverSampler', function () {

    let sampler

    beforeEach(function () {
        sampler = new NeverSampler()
    })

    describe('sample method', function () {

        it('returns false', function () {

            const result = sampler.sample()

            assert.strictEqual(result, false)
        })
    })
})
