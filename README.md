elastic-opentracing
=========================

An alternative unopinionated Elastic APM opentracing agent for Node.js.

Why another apm agent?
======================

[Official agent](https://github.com/elastic/apm-agent-nodejs) is fine, but it is quite opinionated:

- it goes with several predefined instrumenters for common packages - which may be a good thing to get you up and running quickly.
- it also forces you to require it as the very first thing in your project, which is in general looks not quite optimal (just imagine, what if there several such things?).
- it does not work with EcmaScript imports, because of the require hooks.

This module goes the other way - it does not decide for you, it also supports baggage-passing :).

OT Extensions
==========

- span meta (3 places)
- get/set baggage allow non-string values
- new spanOptions

Metafields
==========

Not implemented
===============

- binary injector/extracter

Supported Elastic APM of version 6.5+.


Todo
====

- follows from with parent id link / or without?
- child spans limit & other options

- tests first
- unified for both browser and node?
- see jaeger docs (and other implementations)
- readme
- assert-match? sinon?
- comments?
- is module

- elastic compatibility (-policy)
- send error after finished?
- abstract intrinsic details
- refactoring / perf
- check tests wording & content

===================================================
- hierarhical sequence of ids in serialized string
- start new transaction on service boundary crossing
- multiple parent spans?
- isNumber, isObject...
- accept span to inject / extract
- marks for log?
- "stacktrace" for span
- log errors
- emit async errors
- emit finish = no need
- stacktrace?
- capturestacktrace up to fn
- span stacktrace on span create, not finish
- custom span id name
- span name required (and check other required fields)
- baggage
- transfer baggage in headers/textmap
- sampler & sampling
- "sampled", "span_context.dropped" form transactions
- compare to spec
- sampled on boundaries
- baggage on context field, not root
- cast to spanContext?
- tracer send methods
- tracer finish
- check OT signatures
