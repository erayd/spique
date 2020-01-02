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
const RingBuffer = require("./ringbuffer.js");

module.exports = class Spique extends events.EventEmitter {
  constructor(maxItems, ringSize) {
    super();
    var defaultRingSize = 1000;
    ringSize = ringSize ? parseInt(ringSize) : defaultRingSize;
    if(!maxItems || !(typeof maxItems === 'number'))
      maxItems = Math.floor(Number.MAX_VALUE);

    var firstRing = allocateRing();
    var lastRing = firstRing;
    var spareRing = undefined;
    var rings = 1;
    var items = 0;

    // allocate a new ring, or return the spare if available
    function allocateRing() {
      var newRing = spareRing;
      if(newRing !== undefined)
        spareRing = undefined;
      else
        newRing = new RingBuffer(ringSize);
      return newRing;
    }

    // check whether the buffer is empty
    this.isEmpty = function() {
      return !items;
    };

    // check whether the buffer is full
    this.isFull = function() {
      return items == maxItems;
    }

    // push item(s) onto the end of the buffer
    this.enqueue = this.push = function push(value) {
      if(items >= maxItems)
        throw new Error('Buffer is full');
      // add another ring if necessary
      if(!lastRing.available()) {
        var newRing = allocateRing();
        lastRing.nextRing = newRing;
        newRing.prevRing = lastRing;
        lastRing = newRing;
        rings++;
      }
      lastRing.push(value);
      items++;

      // fire events
      if(items === 1)
        this.emit("ready", this);
      if(items === maxItems)
        this.emit("full", this);

      // process variadic args
      for(var argIndex = 1; argIndex < arguments.length; argIndex++) {
        if(push(arguments[argIndex]))
          throw new Error('Buffer is full');
      }
    }

    // push item(s) onto the start of the buffer
    this.unshift = function unshift(value) {
      if(items >= maxItems)
        throw new Error('Buffer is full');
      // add another ring if necessary
      if(!firstRing.available()) {
        var newRing = allocateRing();
        newRing.nextRing = firstRing;
        firstRing.prevRing = newRing;
        firstRing = newRing;
        rings++;
      }
      firstRing.unshift(value);
      items++;

      // fire events
      if(items === 1)
        this.emit("ready", this);
      if(items === maxItems)
        this.emit("full", this);

      // process variadic args
      for(var argIndex = 1; argIndex < arguments.length; argIndex++) {
        if(unshift(arguments[argIndex]))
          throw new Error('Buffer is full');
      }
    }

    // pop an item off the end of the buffer
    this.pop = function() {
      var value = lastRing.pop();
      // delete the ring if it's empty and not the last one
      if(lastRing.isEmpty() && lastRing.prevRing) {
        lastRing = lastRing.prevRing;
        spareRing = lastRing.nextRing;
        delete lastRing.nextRing;
        rings--;
      }
      items--;
      if (items === 0)
        this.emit("empty", this);
      if (items < maxItems)
        this.emit("space", this);
      return value;
    };

    // pop an item off the start of the buffer
    this.dequeue = this.shift = function() {
      var value = firstRing.shift();
      // delete the ring if it's empty and not the last one
      if(firstRing.isEmpty() && firstRing.nextRing) {
        firstRing = firstRing.nextRing;
        spareRing = firstRing.prevRing;
        delete firstRing.prevRing;
        rings--;
      }
      items--;
      if (items === 0)
        this.emit("empty", this);
      if (items < maxItems)
        this.emit("space", this);
      return value;
    };

    // peek at the end of the buffer
    this.last = this.peek = function() {
      return lastRing.peek();
    };

    // peek at the start of the buffer
    this.first = this.peekStart = function() {
      return firstRing.peekStart();
    };

    // iterator dequeue
    this[Symbol.iterator] = function*() {
      while(!this.isEmpty())
        yield this.dequeue();
    };

    // get the number of items in the buffer
    Object.defineProperty(this, 'length', {get: function() {
      return items;
    }});

    // get the current capacity
    Object.defineProperty(this, 'capacity', {get: function() {
      return rings * ringSize;
    }});

    // get the max number of items
    Object.defineProperty(this, 'maxItems', {get: function() {
      return maxItems | 0;
    }});

    // get the ring size
    Object.defineProperty(this, 'ringSize', {get: function() {
      return ringSize;
    }});
  }
}
