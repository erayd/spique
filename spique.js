/*                                 ISC License
 *
 * Copyright (c) 2016-2020, Erayd LTD
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose
 * with or without fee is hereby granted, provided that the above copyright notice
 * and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
 * OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE,
 * DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS
 * ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

"use strict";
const EventEmitter = require("events").EventEmitter;
const RingBuffer = require("./ringbuffer.js");
const GeneratorFunction = Object.getPrototypeOf(function*() {});

module.exports = class Spique extends EventEmitter {
    constructor(size = 0, ringSize = 1024) {
        super();

        var headRing = new RingBuffer(ringSize);
        var tailRing = headRing;
        var rings = 1;
        var items = 0;
        var closed = false;
        var transforms = [];

        // basic properties
        Object.defineProperties(this, {
            // get the size of the queue
            size: { value: size, writable: false, enumerable: true },

            // get the current number of items in the queue
            length: { get: () => items, enumerable: true },

            // get the current number of free slots in the queue
            free: {
                get: () => (size ? size - items : Number.MAX_SAFE_INTEGER - items),
                enumerable: true
            },

            // get the current closed status of the queue
            closed: { get: () => closed && !items, enumerable: true },

            // get the ring size
            ringSize: { value: ringSize, writable: false, enumerable: true },

            // methods
            enqueue: { value: enqueue, writable: false },
            enqueueHead: { value: enqueueHead, writable: false },
            dequeue: { value: dequeue, writable: false },
            dequeueTail: { value: dequeueTail, writable: false },
            peek: { value: peek, writable: false },
            peekTail: { value: peekTail, writable: false },
            transform: { value: t => transforms.push(t), writable: false },
            close: { value: close, writable: false },

            // iterator
            [Symbol.iterator]: {
                value: function*() {
                    while (items) yield this.dequeue();
                },
                writable: false
            }
        });

        // call listener if event state is valid on attachment
        this.on("newListener", (ev, listener) => {
            if (
                (ev === "data" && items) ||
                (ev === "empty" && !items) ||
                (ev === "full" && !this.free) ||
                (ev === "free" && this.free) ||
                (ev === "close" && this.closed)
            ) {
                listener(this);
            }
        });

        // attach chained source (iterator | generator | Spique)
        async function attachSource(source, forward = true, applyTransforms = true) {
            let insert = forward ? "enqueue" : "enqueueHead";
            if (source instanceof Spique) {
                source.on("data", s => {
                    this[insert](s[Symbol.iterator](), true, applyTransforms);
                });
                source.on("close", () => this.close());
                return;
            } else if (Symbol.iterator in source) source = source[Symbol.iterator]();
            if (Symbol.asyncIterator in source) {
                for await (let next of source) {
                    await new Promise(async resolve => {
                        let feed = target => {
                            if (target.free) {
                                target[insert](next, false, applyTransforms);
                                resolve();
                            } else this.once("free", feed);
                        };
                        feed(this);
                    });
                }
            } else {
                let feed = target => {
                    let again = true;
                    while (target.free) {
                        let next = source.next();
                        if (next.done) {
                            again = false;
                            break;
                        } else target[insert](next.value, false, applyTransforms);
                    }
                    if (again) this.once("free", feed);
                };
                feed(this);
            }
        }

        // apply transforms & return a generator instance
        function transform(value) {
            let result = (function*() {
                yield value;
            })();

            for (let transform of transforms) {
                let input = result;
                if (Object.getPrototypeOf(transform) === GeneratorFunction) {
                    result = (function*() {
                        for (let r of input) {
                            for (let r2 of transform(r)) yield r2;
                        }
                    })();
                } else {
                    result = (function*() {
                        for (let r of input) yield transform(r);
                    })();
                }
            }

            return result;
        }

        // close the queue
        function close() {
            closed = true;
            if (!items) this.emit("close", this);
        }

        // add an item to the tail of the queue
        function enqueue(value, isSource = false, applyTransforms = true) {
            // attach source
            if (isSource) {
                attachSource.call(this, value, true, applyTransforms);
                return;
            }

            // apply transforms
            if (applyTransforms && transforms.length) {
                this.enqueue(transform.call(this, value), true, false);
                return;
            }

            // check queue is open
            if (this.closed) throw new Error("Queue is closed");

            // check available space
            if (!this.free) throw new Error("Queue is full");

            // allocate a new ring
            if (!tailRing.free) {
                let r = tailRing._below || new RingBuffer(ringSize);
                r._above = tailRing;
                tailRing._below = r;
                tailRing = r;
                rings++;
            }

            // enqueue data
            tailRing.push(value);
            ++items;

            // fire events
            if (!this.free) this.emit("full", this);
            if (items === 1) this.emit("data", this);
        }

        // add an item to the head of the queue
        function enqueueHead(value, isSource = false, applyTransforms = true) {
            // attach source
            if (isSource) {
                attachSource.call(this, value, false, applyTransforms);
                return;
            }

            // apply transforms
            if (applyTransforms && transforms.length) {
                this.enqueueHead(transform.call(this, value), true, false);
                return;
            }

            // check queue is open
            if (this.closed) throw new Error("Queue is closed");

            // check available space
            if (!this.free) throw new Error("Queue is full");

            // allocate a new ring
            if (!headRing.free) {
                let r = headRing._above || new RingBuffer(ringSize);
                r._below = headRing;
                headRing._above = r;
                headRing = r;
                rings++;
            }

            // enqueue data
            headRing.unshift(value);
            ++items;

            // fire events
            if (!this.free) this.emit("full", this);
            if (items === 1) this.emit("data", this);
        }

        // peek at the value at the head of the queue
        function peek() {
            if (!items) throw new Error("Queue is empty");

            return headRing.peekStart();
        }

        // peek at the value at the tail of the queue
        function peekTail() {
            if (!items) throw new Error("Queue is empty");

            return tailRing.peek();
        }

        // remove an item from the head of the queue
        function dequeue() {
            if (!items) throw new Error("Queue is empty");

            let value = headRing.shift();
            --items;

            // deallocate unused buffer
            if (!headRing.length && rings > 1) {
                headRing._above = undefined;
                headRing = headRing._below;
                rings--;
            }

            // fire events
            if (!items) {
                this.emit("empty", this);
                if (closed) this.emit("close", this);
            }
            if (this.free && !closed) this.emit("free", this);

            return value;
        }

        // remove an item from the tail of the queue
        function dequeueTail() {
            if (!items) throw new Error("Queue is empty");

            let value = tailRing.pop();
            --items;

            // deallocate unused buffer
            if (!tailRing.length && rings > 1) {
                tailRing._below = undefined;
                tailRing = tailRing._above;
                rings--;
            }

            // fire events
            if (!items) {
                this.emit("empty", this);
                if (closed) this.emit("close", this);
            }
            if (this.free && !closed) this.emit("free", this);

            return value;
        }
    }
};
