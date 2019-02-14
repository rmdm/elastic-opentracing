const stackman = require('stackman')()
const path = require('path')

async function getStackTrace (objWithStack) {

    const callsites = await new Promise(function (resolve, reject) {
        stackman.callsites(objWithStack, function (err, callsites) {
            if (err) {
                return reject(err)
            }
            resolve(callsites)
        })
    })

    return Promise.all(callsites.map(getStackFrame))
}

const emptySourceContext = { pre: null, post: null, line: null }

async function getStackFrame (callsite) {

    const sourceContext = await new Promise(function (resolve, reject) {
        callsite.sourceContext(function (err, sourceContext) {
            if (err) {
                return resolve(emptySourceContext)
            }
            resolve(sourceContext)
        })
    })

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

module.exports = getStackTrace
