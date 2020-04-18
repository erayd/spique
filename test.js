#!/usr/bin/env node
"use strict";

const assert = require("assert");
const events = require("events");
const Spique = require("./spique.js");
const GeneratorFunction = function*() {}.prototype.constructor;

// create (defaults)
{
    let s = new Spique();
    assert(s instanceof Spique);
    assert(s.ringSize === 1024);
    assert(s.free === Number.MAX_SAFE_INTEGER);
    assert(s.length === 0);
}

// create (manual size & ringsize)
{
    let s = new Spique(10, 3);
    assert(s.free === 10);
    assert(s.ringSize === 3);
    assert(s.length === 0);
}

// basic queue operation on both ends
{
    let s = new Spique(10, 3);
    s.enqueue(3);
    s.enqueueHead(2);
    s.enqueue(4);
    s.enqueueHead(1);
    assert(s.length === 4);
    assert(s.peek() === 1);
    assert(s.peekTail() === 4);
    assert(s.dequeue() === 1);
    assert(s.dequeue() === 2);
    assert(s.dequeueTail() === 4);
    assert(s.dequeueTail() === 3);
    assert(s.length === 0);
    assert(s.free === 10);
}

// queue flow (forward)
{
    let s = new Spique(10, 3);
    let k = 1;
    let l = 0;
    for (let i = 1; i <= 100; i++) {
        s.enqueue(i);
        assert(s.length === ++l);
        if (i % 8 === 0) {
            for (let j = 0; j < 8; j++) {
                assert(s.dequeue() === k++);
            }
            l -= 8;
        }
    }
    assert(s.length === 4);
}

// queue flow (backward)
{
    let s = new Spique(10, 3);
    let k = 1;
    let l = 0;
    for (let i = 1; i <= 100; i++) {
        s.enqueueHead(i);
        assert(s.length === ++l);
        if (i % 8 === 0) {
            for (let j = 0; j < 8; j++) {
                assert(s.dequeueTail() === k++);
            }
            l -= 8;
        }
    }
    assert(s.length === 4);
}

// events
{
    let events = {
        full: [
            {
                // forward
                prepare: s => s.enqueue(1),
                reset: s => s.dequeue(),
                then: s => s.enqueue(1)
            },
            {
                // backward
                prepare: s => s.enqueueHead(1),
                reset: s => s.dequeueTail(),
                then: s => s.enqueueHead(1)
            }
        ],
        empty: [
            { reset: s => s.enqueue(1), then: s => s.dequeue() }, //forward
            { reset: s => s.enqueueHead(1), then: s => s.dequeueTail() } //backward
        ],
        data: [
            {
                // forward
                prepare: s => s.enqueue(1),
                reset: s => s.dequeue(),
                then: s => s.enqueue(1)
            },
            {
                // backward
                prepare: s => s.enqueueHead(1),
                reset: s => s.dequeueTail(),
                then: s => s.enqueueHead(1)
            }
        ],
        free: [
            { reset: s => s.enqueue(1), then: s => s.dequeue() }, //forward
            { reset: s => s.enqueueHead(1), then: s => s.dequeueTail() } //backward
        ]
    };

    for (let ev in events) {
        for (let test of events[ev]) {
            let s = new Spique(1);
            let i = 0;

            (test.prepare || (() => {}))(s);
            s.on(ev, v => {
                assert(v === s);
                ++i;
            });
            (test.reset || (() => {}))(s);
            (test.then || (() => {}))(s);

            assert(i === 2);
        }
    }

    // test close separately, as it's not resettable
    let closed = false;
    let s1 = new Spique();
    s1.on("close", () => (closed = true));
    assert(closed === false);
    s1.close();
    assert(closed === true);
    assert(s1.closed === true);
    s1.on("close", () => (closed = true));
    assert(closed === true);

    closed = false;
    let s2 = new Spique();
    s2.enqueue(1);
    s2.close();
    assert(s2.closed === false);
    s2.on("close", () => (closed = true));
    assert(s2.closed === false);
    s2.dequeue();
    assert(s2.closed === true);
    assert(closed === true);

    closed = false;
    let s3 = new Spique();
    s3.enqueueHead(1);
    s3.close();
    assert(s3.closed === false);
    s3.on("close", () => (closed = true));
    assert(s3.closed === false);
    s3.dequeueTail();
    assert(s3.closed === true);
    assert(closed === true);

    let s4 = new Spique();
    s4.enqueue(1);
    s4.close();
    s4.enqueue(2);
    assert(s4.length === 2);
    s4.dequeue();
    s4.dequeue();
    try {
        s4.enqueue(3);
        assert(false);
    } catch (err) {}
}

// iterator & chaining
{
    // iterate out
    let s = new Spique(10);
    for (let i = 0; i < 10; i++) s.enqueue(i);
    let j = 0;
    for (let i of s) assert(i === j++);
    assert(s.length === 0);

    // iterate in
    function* source(start = 0, count = 20) {
        for (let i = start; i < start + count; i++) yield i;
    }
    s.enqueue(source(0), true);
    s.enqueue(source(20), true);
    assert(s.length === 10);
    assert(s.peek() === 0);
    assert(s.peekTail() === 9);
    for (let i = 0; i < 10; i++) s.dequeue();
    assert(s.length === 10);
    assert(s.peek() === 10);
    assert(s.peekTail() === 19);

    // chain
    let s2 = new Spique(10);
    assert(s2.length === 0);
    assert(events.EventEmitter.listenerCount(s2, "free") === 0);
    s2.enqueue(s, true);
    assert(events.EventEmitter.listenerCount(s2, "free") === 1);
    assert(s.dequeue() === 20);
    assert(s.length === 10);
    assert(s2.length === 10);
    assert(s2.dequeue() === 10);
    assert(s.length === 10);
    assert(s2.length === 10);
    for (let noop of s2);
    assert(events.EventEmitter.listenerCount(s2, "free") === 0);
    s.enqueue(1);
    assert(s2.dequeue() === 1);

    // reverse
    let s3 = new Spique();
    s3.enqueueHead(s2, true);
    for (let i = 0; i < 10; i++) s.enqueue(i);
    assert(s3.dequeue() === 9);
    assert(s3.dequeueTail() === 0);

    // close
    let closed = false;
    s.close();
    let s4 = new Spique();
    s4.on("close", () => (closed = true));
    assert(closed === false);
    assert(closed === false);
    assert(s.closed === true);
    assert(s2.closed === true);
    assert(s3.closed === false);
    assert(s4.closed === false);
    s4.enqueue(s3, true);
    assert(s3.closed === true);
    assert(s4.closed === false);
    for (let noop of s4);
    assert(s4.closed === true);
    assert(closed === true);

    // async
    (async () => {
        let g = async function*(limit) {
            for (let i = 0; i < limit; i++) yield i;
        };
        let s = new Spique(5);
        s.enqueue(g(10), true);
        await new Promise(resolve => s.on("full", resolve));
        assert(s.length === 5);
        assert(s.dequeue() === 0);
    })();

    // full
    let s5 = new Spique(1);
    s5.enqueue(1);
    s5.enqueue((function*() {
        yield 2;
    })(), true);
    assert(s5.length === 1);
    assert(s5.dequeue() === 1);
    assert(s5.length === 1);
    assert(s5.dequeue() === 2);
}

// transforms
{
    let s = new Spique();

    // plain functions
    s.transform((value, reject) => {
        if (value === 9) reject();
        return value;
    });
    s.transform(value => value * value);
    s.transform(value => value + 3);
    s.enqueue(2);
    s.enqueue(9);
    assert(s.length === 1);
    assert(s.dequeue() === 7);

    // generators
    s.transform(function*(n) {
        while (n) yield n--;
    });
    s.enqueue(2);
    assert(s.length === 7);
    assert(s.dequeue() === 7);
    assert(s.dequeueTail() === 1);
    for (let noop of s);

    // backwards
    s.enqueueHead(2);
    s.enqueueHead(9);
    assert(s.length === 7);
    assert(s.dequeue() === 1);
    assert(s.dequeueTail() === 7);
}
