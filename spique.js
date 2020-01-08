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

module.exports = class Spique extends EventEmitter {
    constructor(size = 0, ringSize = 1024) {
        super();

        var headRing = new RingBuffer(ringSize);
        var tailRing = headRing;
        var rings = 1;
        var items = 0;

        // basic properties
        Object.defineProperties(this, {
            // get the size of the queue
            size: { value: size, writable: false, enumerable: true },

            // get the current number of items in the queue
            length: { get: () => items, enumerable: true },

            // get the current number of free slots in the queue
            free: {
                get: () => (size ? size - items : Number.MAX_SAFE_INTEGER),
                enumerable: true
            },

            // methods
            ringSize: { value: ringSize, writable: false, enumerable: true },
            enqueue: { value: enqueue, writable: false },
            enqueueHead: { value: enqueueHead, writable: false },
            dequeue: { value: dequeue, writable: false },
            dequeueTail: { value: dequeueTail, writable: false },
            peek: { value: peek, writable: false },
            peekTail: { value: peekTail, writable: false },

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
                (ev === "free" && this.free)
            ) {
                listener(this);
            }
        });

        // add an item to the tail of the queue
        function enqueue(value) {
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
        function enqueueHead(value) {
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

        // peek at the value at the head of the queue
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
            if (!items) this.emit("empty", this);
            if (this.free) this.emit("free", this);

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
            if (!items) this.emit("empty", this);
            if (this.free) this.emit("free", this);

            return value;
        }
    }
};
