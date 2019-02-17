const SpanContext = require('../span_context')
const base64 = require('../util/base64')
const is = require('../util/is')

const CONTEXT_ID_KEY = 'elastic-ot-span-id'
const BAGGAGE_KEY = 'elastic-ot-baggage'

function inject (spanContext, carrier, options = {}) {

    const contextIdKey = is.string(options.contextIdKey)
        ? options.contextIdKey
        : CONTEXT_ID_KEY

    const baggageKey = is.string(options.baggageKey)
        ? options.baggageKey
        : BAGGAGE_KEY

    carrier[contextIdKey] = [
        spanContext.getTraceId(),
        spanContext.getTransactionId(),
        spanContext.getParentId(),
        spanContext.getId(),
        spanContext.isSampled() ? '1' : '0',
    ].join(':')

    carrier[baggageKey] = base64.encode(JSON.stringify(spanContext.getBaggage()))
}

function extract (carrier, options = {}) {

    const contextIdKey = is.string(options.contextIdKey)
        ? options.contextIdKey
        : CONTEXT_ID_KEY

    const baggageKey = is.string(options.baggageKey)
        ? options.baggageKey
        : BAGGAGE_KEY

    if (!is.string(carrier[contextIdKey])) {
        return null
    }

    const spanContext = new SpanContext()

    const [ trace_id, transaction_id, parent_id, id, sampled ] =
        carrier[contextIdKey].split(':')

    if (id) {
        spanContext.setId(id)
    }
    if (transaction_id) {
        spanContext.setTransactionId(transaction_id)
    }
    if (trace_id) {
        spanContext.setTraceId(trace_id)
    }
    if (parent_id) {
        spanContext.setParentId(parent_id)
    }
    if (sampled) {
        spanContext.setSampled(sampled === '1')
    }

    if (carrier[baggageKey]) {
        spanContext.setBaggage(JSON.parse(base64.decode(carrier[baggageKey])))
    }

    return spanContext
}

module.exports = { inject, extract }
