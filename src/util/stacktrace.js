const stackman = require('stackman')()
const path = require('path')

const is = require('./is')

async function getStackTrace (objWithStack, cb) {

    stackman.callsites(objWithStack, function (err, callsites) {

        if (err) {
            return cb(err)
        }

        if (!callsites.length) {
            return callsites
        }

        const result = new Array(callsites.length)

        let calls = 0, done = false

        for (let i = 0; i < callsites.length; i++) {
            getStackFrame(callsites[i], function (err, frame) {

                calls++

                if (err && !done) {
                    done = true
                    return cb(err)
                }

                result[i] = frame

                if (calls === callsites.length && !done) {
                    done = true
                    cb(null, result)
                }
            })
        }
    })
}

const emptySourceContext = { pre: null, post: null, line: null }

async function getStackFrame (callsite, cb) {

    callsite.sourceContext(function (err, sourceContext) {
        if (err) {
            return cb(null, mapCallsite(callsite, emptySourceContext))
        }
        cb(null, mapCallsite(callsite, sourceContext))
    })
}

function mapCallsite (callsite, sourceContext) {

    const absFileName = callsite.getFileName()
    const filename = path.basename(absFileName)

    return {
        abs_path: absFileName,
        colno: callsite.getColumnNumber(),
        context_line: sourceContext.line,
        filename: filename,
        function: callsite.getFunctionName(),
        library_frame: !callsite.isApp(),
        lineno: callsite.getLineNumber(),
        module: callsite.getModuleName(),
        post_context: sourceContext.post,
        pre_context: sourceContext.pre,
    }
}

function getCulprit (stacktrace) {

    if (!is.array(stacktrace) || !stacktrace.length) {
        return null
    }

    const topFrame = stacktrace[0]

    if (topFrame.function) {
        if (topFrame.abs_path) {
            return `${topFrame.function} (${topFrame.abs_path})`
        } else {
            return topFrame.function
        }
    } else {
        if (topFrame.abs_path) {
            return topFrame.abs_path
        } else {
            return ''
        }
    }
}

module.exports = { getStackTrace, getCulprit }
