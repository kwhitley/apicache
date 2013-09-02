treeize
=======

_v0.0.3_

Converts row data (in JSON/associative array format) to object/tree structure based on column naming conventions.

## Installation

`npm install --save treeize`

## Usage

Treeize currently has a single function, `grow`, that takes your results/rows of flat associative data and returns a full object graph;

- The column/attribute order is not important.  All attributes are sorted by depth before mapping.
- To imply a collection, use a plural name (e.g. "subjects" instead of "subject").  Otherwise, use a singular name.
- Use a `+` to seperate path nodes (e.g. "toys+name" implies a "toys" collection on a root level item.  Each toy item would have [at least] a "name" attribute)

```
var treeize = require('treeize');

var flatData = [
  {
    "name":             "Mittens",
    "age":              12,
    "toys+name":        "mouse",
    "toys+owner+name":  "Mittens"
  },
  {
    "name":             "Mittens",
    "age":              12,
    "toys+name":        "yarn",
    "toys+owner+name":  "Ms. Threadz"
  },
  {
    "name":             "Tiger",
    "age":              7,
    "toys+name":        "a stick",
    "toys+owner+name":  "Mother Nature"
  }
];

var converted = treeize.grow(flatData);
```

### Output

```
[
  {
    "name": "Mittens",
    "age": 12,
    "toys": [
      {
        "name": "mouse",
        "owner": {
          "name": "Mittens"
        }
      },
      {
        "name": "yarn",
        "owner": {
          "name": "Ms. Threadz"
        }
      }
    ]
  },
  {
    "name": "Tiger",
    "age": 7,
    "toys": [
      {
        "name": "a stick",
        "owner": {
          "name": "Mother Nature"
        }
      }
    ]
  }
]
```
