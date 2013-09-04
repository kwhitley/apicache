var treeize = require('../lib/treeize');

var flatData1 = [
  {
    "name":             "Mittens",
    "age":              12,
    "toys:name":        "mouse",
    "toys:owner:name":  "Mittens"
  },
  {
    "name":             "Mittens",
    "age":              12,
    "toys:name":        "yarn",
    "toys:owner:name":  "Ms. Threadz"
  },
  {
    "name":             "Tiger",
    "age":              7,
    "toys:name":        "a stick",
    "toys:owner:name":  "Mother Nature"
  }
];

var treeData1 = [
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
];

module.exports = {
  '.defaultOptions() returns expected defaults': function (test) {
    test.expect(1);
    test.deepEqual(treeize.getOptions(), { delimiter: ':' });
    test.done();
  },
  '.setOptions() correctly sets options': function (test) {
    treeize.setOptions({ delimiter: '+' });
    test.expect(1);
    test.equal(treeize.getOptions().delimiter, '+');
    test.done();
  },
  'globalOptions should remain set': function (test) {
    test.expect(1);
    test.equal(treeize.getOptions().delimiter, '+');
    test.done();
  },
  '.setOptions() returns self': function (test) {
    test.expect(1);
    test.ok(treeize.setOptions({ delimiter: ':' }).grow);
    test.done();
  },
  '.grow expands correctly': function (test) {
    test.expect(1);
    test.deepEqual(treeize.grow(flatData1), treeData1);
    test.done();
  }
};
