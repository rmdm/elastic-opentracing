const assert = require('assert')
const path = require('path')
const { getStackTrace } = require('../../src/util/stacktrace')

describe('getStackTrace utility', function () {

    it('return stacktrace object', function testFn (done) {

        const obj = {}

        Error.captureStackTrace(obj)

        getStackTrace(obj, function (err, stacktrace) {

            try {

                assert.ifError(err)

                const topFrame = stacktrace[0]
                const restFrames = stacktrace.slice(1)

                assert.deepStrictEqual(topFrame, {
                    abs_path: __filename,
                    colno: 15,
                    context_line: '        Error.captureStackTrace(obj)',
                    filename: path.basename(__filename),
                    function: 'testFn',
                    library_frame: false,
                    lineno: 11,
                    module: null,
                    post_context: [
                        '',
                        '        getStackTrace(obj, function (err, stacktrace) {'
                    ],
                    pre_context: [
                        '        const obj = {}',
                        ''
                    ]
                })

                for (const frame of restFrames) {
                    assert(typeof frame.abs_path === 'string')
                    assert(typeof frame.colno === 'number')
                    assert(typeof frame.context_line === 'string' || frame.context_line === null)
                    assert(typeof frame.filename === 'string')
                    assert(typeof frame.function === 'string' || frame.function === null)
                    assert(typeof frame.library_frame === 'boolean')
                    assert(typeof frame.lineno === 'number')
                    assert(typeof frame.module === 'string' || frame.context_line === null)
                    assert(frame.post_context === null || Array.isArray(frame.post_context))
                    assert(frame.pre_context === null || Array.isArray(frame.pre_context))
                }

                done()
            } catch (err) {
                done(err)
            }
        })
    })
})
