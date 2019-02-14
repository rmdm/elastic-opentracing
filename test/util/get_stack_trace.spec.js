const assert = require('assert')
const getStackTrace = require('../../src/util/get_stack_trace')

describe('getStackTrace utility', function () {

    it('return stacktrace object', async function testFn () {

        const obj = {}

        Error.captureStackTrace(obj)

        const stacktrace = await getStackTrace(obj)

        const topFrame = stacktrace[0]
        const restFrames = stacktrace.slice(1)

        assert.deepStrictEqual(topFrame, {
            abs_path: __filename,
            colno: 15,
            context_line: '        Error.captureStackTrace(obj)',
            filename: 'get_stack_trace.spec.js',
            function: 'testFn',
            library_frame: false,
            lineno: 10,
            module: null,
            post_context: [
                '',
                '        const stacktrace = await getStackTrace(obj)'
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
    })
})
