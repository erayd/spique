Spique - A Spiral Double-Ended Queue
====================================

Spique is a deque implemented as a doubly-linked list of circular buffers. This
structure allows for both high performance and unlimited dynamic growth of the
queue. All operations are O(1) (constant time).

Spique does not require an initial or maximum size (although you can define a
maximum if you wish), and will both grow and shrink dynamically as items are
added and removed.

Spique is available [via npm](https://www.npmjs.com/package/spique):
```bash
npm install spique
```

## API
```javascript
var Spique = require('spique');
var s = new Spique(maxItems, ringSize);
```
`maxItems` sets the maximum number of items which may be stored in the queue at
any given time. Attempting to store more items than this will return an error. If
maxItems is falsy, then there is no maximum, and the queue may continue to grow
as long as there is available memory. By default, `maxItems` is unlimited.

`ringSize` sets the number of items stored in each ring. This defaults to 1000,
which is normally fine for most purposes. Dynamic resizing is done in chunks of
`ringSize` items (i.e. one buffer at a time).

Both `maxItems` and `ringSize` are optional.

Spique can also be used as an iterator - this pattern will call dequeue() until
the queue is empty.
```javascript
for(myValue of s) {
  doSomething(myValue);
}
```

### .push(), .enqueue()
```javascript
s.push(myValue...);
s.enqueue(myValue...);
```
Append a value to the end of the queue. If a max queue size has been set, and the
queue is full, then this method will return an error. `enqueue()` and `push()` are
synonymous.

If more than one value is supplied, then they will all be added to the queue
in the order that they are supplied.

### .shift(), .dequeue()
```javascript
var myValue = s.shift();
var myValue = s.dequeue();
```
Return the value at the head of the queue, and remove it from the queue. If the
queue is empty, this method will return undefined. `dequeue()` and `shift()` are
synonymous.

### .unshift()
```javascript
s.unshift(myValue...);
```
Prepend a value to the head of the queue. If a max queue size has been set, and
the queue is full, then this method will return an error.

If more than one value is supplied, then they will all be added to the queue
in the order that they are supplied.

### .pop()
```javascript
var myValue = s.pop();
```
Return the value at the end of the queue, and remove it from the queue. If the
queue is empty, then this method will return undefined.

### .last(), .peek()
```javascript
var myValue = s.last();
var myValue = s.peek();
```
Return the value at the end of the queue. The value is not removed. If the queue
is empty, then this method will return undefined. `last()` and `peek()` are synonymous.

### .first(), .peekStart()
```javascript
var myValue = s.first();
var myValue = s.peekStart();
```
Return the value at the head of the queue. The value is not removed. If the queue
is empty, then this method will return undefined. `first()` and `peekStart()` are
synonymous.

### .isEmpty()
```javascript
if (s.isEmpty()) {
    // the queue is empty
}
```
Check whether the queue is currently empty.

### .isFull()
```javascript
if (s.isFull()) {
    // the queue is full
}
```
Check whether the queue is currently empty.

### Properties
#### .length
The number of items currently stored in the queue.

#### .capacity
The current capacity of the queue - this will grow as items are inserted.

#### .maxItems
The maximum number of items allowed in the buffer at any given time. If this is
unlimited, then maxItems will be zero.

#### .ringSize
The size of each circular buffer. The queue will grow / shrink by this many items
at a time.

### Events
#### ready
The queue has one or more items stored in it.

#### full
The queue is full.

#### empty
The queue is empty.

#### space
The queue has space available to store more items.
