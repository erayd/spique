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
const events = require("events");

module.exports = class Ringbuffer extends events.EventEmitter {
    constructor(size) {
        super();
        var head = 0;
        var items = 0;
        var buffer = new Array(size);

        // check whether the buffer is empty
        this.isEmpty = function() {
            return !items;
        };

        // get the number of free slots
        this.available = function() {
            return size - items;
        };

        // push item onto the end of the buffer
        this.push = function(value) {
            if (items < size) {
                var pos = (head + items++) % size;
                buffer[pos] = value;
                if (items === 1) this.emit("ready", this);
                if (items === size) this.emit("full", this);
            } else throw new Error("Buffer is full");
        };

        // push item onto the start of the buffer
        this.unshift = function(value) {
            if (items < size) {
                var pos = head ? --head : (head = size - 1);
                buffer[pos] = value;
                items++;
                if (items === 1) this.emit("ready", this);
                if (items === size) this.emit("full", this);
            } else throw new Error("Buffer is full");
        };

        // pop an item off the end of the buffer
        this.pop = function() {
            if (this.isEmpty()) return undefined;
            var pos = (head + --items) % size;
            var value = buffer[pos];
            buffer[pos] = undefined;
            if (this.isEmpty()) this.emit("empty", this);
            if (items < size) this.emit("space", this);
            return value;
        };

        // pop an item off the start of the buffer
        this.shift = function() {
            if (this.isEmpty()) return undefined;
            var value = buffer[head];
            buffer[head] = undefined;
            if (++head == size) head = 0;
            items--;
            if (this.isEmpty()) this.emit("empty", this);
            if (items < size) this.emit("space", this);
            return value;
        };

        // peek at the end of the buffer
        this.peek = function() {
            if (this.isEmpty()) return undefined;
            return buffer[(head + (items - 1)) % size];
        };

        // peek at the start of the buffer
        this.peekStart = function() {
            if (this.isEmpty()) return undefined;
            return buffer[head];
        };

        // get the number of items in the buffer
        Object.defineProperty(this, "length", {
            get: function() {
                return items;
            }
        });
    }
};
