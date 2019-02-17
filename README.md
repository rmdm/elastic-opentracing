elastic-opentracing [![Build Status](https://travis-ci.org/rmdm/elastic-opentracing.svg?branch=master)](https://travis-ci.org/rmdm/elastic-opentracing) [![Coverage Status](https://coveralls.io/repos/github/rmdm/elastic-opentracing/badge.svg?branch=master)](https://coveralls.io/github/rmdm/elastic-opentracing?branch=master)
===================

An alternative unopinionated Elastic APM OpenTracing agent for Node.js.

Why another apm agent?
======================

[Official agent](https://github.com/elastic/apm-agent-nodejs) is fine, but it is quite opinionated:

- it goes with several predefined instrumenters for common packages - which may be a good thing to get you up and running quickly
- it also forces you to require it as the very first thing in your project, which is in general looks not quite optimal (just imagine, what if there several such things?)
- it does not work with EcmaScript native imports, because of the require hooks

This module goes the other way - it gives you full control on how, when and what is going to be instantiated and instrumented.
