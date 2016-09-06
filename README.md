Spique - A Spiral Double-Ended Queue
====================================

Spique is a deque implemented as a doubly-linked list of circular buffers. This
structure allows for both high performance and unlimited dynamic growth of the
queue.

Spique does not require an initial or maximum size (although you can define a
maximum if you wish), and will both grow and shrink dynamically as items are
added and removed.

## API
```javascript
var Spique = require('spique');
var s = new Spique(maxItems, ringSize);
```
`maxItems` sets the maximum number of items which may be stored in the queue at
any given time. Attempting to store more items than this will throw an error. If
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
s.push(myValue);
s.enqueue(myValue);
```
Append a value to the end of the queue. If a max queue size has been set, and the
queue is full, then this method will throw an error. `enqueue()` and `push()` are
synonymous.

### .shift(), .dequeue()
```javascript
var myValue = s.shift();
var myValue = s.dequeue();
```
Return the value at the head of the queue, and remove it from the queue. If the
queue is empty, this method will throw an error. `dequeue()` and `shift()` are
synonymous.

### .unshift()
```javascript
s.unshift(myValue);
```
Prepend a value to the head of the queue. If a max queue size has been set, and
the queue is full, then this method will throw an error.

### .pop()
```javascript
var myValue = s.pop();
```
Return the value at the end of the queue, and remove it from the queue. If the
queue is empty, then this method will throw an error.

### .peek()
```javascript
var myValue = s.peek();
```
Return the value at the end of the queue. The value is not removed. If the queue
is empty, then this method will throw an error.

### .peekStart()
```javascript
var myValue = s.peekStart();
```
Return the value at the head of the queue. The value is not removed. If the queue
is empty, then this method will throw an error.

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
