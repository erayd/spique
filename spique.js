/*                                 ISC License
 *
 * Copyright (c) 2016, Erayd LTD
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
module.exports = Spique;

function Spique(maxItems, ringSize) {
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
    return firstRing == lastRing && firstRing.isEmpty();
  };

  // push item(s) onto the end of the buffer
  this.enqueue = this.push = function() {
    for(var value of arguments) {
      if(items >= maxItems)
        return new Error('Buffer is full');
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
    }
  }

  // push item(s) onto the start of the buffer
  this.unshift = function(value) {
    for(var value of arguments) {
      if(items >= maxItems)
        return new Error('Buffer is full');
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

function RingBuffer(size) {
  var head = 0;
  var items = 0;
  var buffer = new Array(size);

  // check whether the buffer is empty
  this.isEmpty = function() {
    return !items;
  }

  // get the number of free slots
  this.available = function() {
    return size - items;
  }

  // push item onto the end of the buffer
  this.push = function(value) {
    var pos = (head + items++) % size;
    buffer[pos] = value;
  };

  // push item onto the start of the buffer
  this.unshift = function(value) {
    var pos = head ? --head : (head = size - 1);
    buffer[pos] = value;
    items++;
  };

  // pop an item off the end of the buffer
  this.pop = function() {
    if(this.isEmpty())
      return undefined;
    var pos = (head + --items) % size;
    var value = buffer[pos];
    buffer[pos] = undefined;
    return value;
  };

  // pop an item off the start of the buffer
  this.shift = function() {
    if(this.isEmpty())
      return undefined;
    var value = buffer[head];
    buffer[head] = undefined;
    if(++head == size)
      head = 0;
    items--;
    return value;
  };

  // peek at the end of the buffer
  this.peek = function() {
    if(this.isEmpty())
      return undefined;
    return buffer[(head + (items - 1)) % size];
  };

  // peek at the start of the buffer
  this.peekStart = function() {
    if(this.isEmpty())
      return undefined;
    return buffer[head];
  };

  // get the number of items in the buffer
  Object.defineProperty(this, 'length', {get: function() {
    return items;
  }});
}
