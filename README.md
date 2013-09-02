treeize
=======

_v0.0.4_

Converts row data (in JSON/associative array format) to object/tree structure based on column naming conventions.

## Installation

`npm install --save treeize`

## Usage

- `treeize.grow(flatData, options)` - takes your results/rows of flat associative data and returns a full object graph.
- `treeize.set(options)` - sets global options for the lib.  For example, to use a path delimiter of '>' instead of '+', call `treeize.set({ delimiter: '>' })`

### Notes

- The column/attribute order is not important.  All attributes are sorted by depth and then alphabetically before mapping.
- Each attribute name of the flat data must consist of the full path to its node & attribute, seperated by the delimiter.  `id` suggests an `id` attribute on a root element, whereas `name+first` implies a `first` attribute on a `name` object within a root element.
- To imply a collection in the path/attribute-name, use a plural name (e.g. "subjects" instead of "subject").  Otherwise, use a singular name for a singular object.
- Use a `+` delimiter (default) to seperate path nodes.  To change this, use the `treeize.set([options])` function.

### Assumptions

This library has several assumptions that make it possible.

1. That each row represents a singular child item, that may contain many repeated ancestor columns.
2. That each element in a collection node (including the root) will have a unique identifying signature (necessary to prevent duplication).  This can be any one attribute, or the combination of any/all attributes.

### Example

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
