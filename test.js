#!/usr/bin/env -S node --expose-gc
"use strict";

const assert = require("assert");
const events = require("events");
const Spique = require("./spique.js");

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
}

// iterator
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
    for(let noop of s2);
    assert(events.EventEmitter.listenerCount(s2, "free") === 0);
    s.enqueue(1);
    assert(s2.dequeue() === 1);

    // reverse
    let s3 = new Spique();
    s3.enqueueHead(s2, true);
    for (let i = 0; i < 10; i++) s.enqueue(i);
    assert(s3.dequeue() === 9);
    assert(s3.dequeueTail() === 0);
}


// memory
{
    global.gc();
    let start = process.memoryUsage();

    let s = new Spique();

    for (let i = 0; i < 1000000; ++i) s.enqueue(i);
    let full = process.memoryUsage();

    for (let i = 0; i < 1000000; ++i) s.dequeue(i);
    global.gc();
    let end = process.memoryUsage();

    assert(full.heapUsed < start.heapUsed + 15000000);
    assert(end.heapUsed < start.heapUsed + 500000);
}
