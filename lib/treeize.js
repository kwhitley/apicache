var _                   = require('lodash');
_.inflection            = require('inflection');
_.mixin(_.inflection);

function options = {
  delimiter: '+'
};

function expand(flatData, config) {
  var localOptions  = _.extend(config || {}, options);
  var translated    = [];

  if (!flatData || !flatData.length) { return flatData; }

  _.each(flatData, function(row, index) {
    var paths           = [];
    var trails          = {};

    // set up paths for processing
    _.each(row, function(value, fullPath) {
      var splitPath = fullPath.split(localOptions.delimiter);

      paths.push({
        splitPath:  splitPath.slice(0, splitPath.length - 1),
        fullPath:   splitPath.slice(0, splitPath.length - 1).join(localOptions.delimiter),
        parentPath: splitPath.slice(0, splitPath.length - 2).join(localOptions.delimiter),
        node:       splitPath.slice(splitPath.length - 2, splitPath.length - 1).join(localOptions.delimiter),
        attribute:  _.last(splitPath),
        value:      value,
        processed:  false
      });
    });

    // sort paths to prepare for processing
    paths.sort(function(a, b) {
      if (a.splitPath.length !== b.splitPath.length) {
        return a.splitPath.length < b.splitPath.length ? -1 : 1;
      }

      return a.parentPath < a.parentPath ? -1 : 1;
    });

    // proccess each unprocessed path in the row
    var trail = translated;

    while (_.findWhere(paths, { processed: false })) {
      var target = _.findWhere(paths, { processed: false });

      // get associated group
      var group = _.where(paths, { parentPath: target.parentPath, node: target.node, processed: false });

      // build blueprint for current group
      var blueprint = {};
      _.each(group, function(groupItem) {
        blueprint[groupItem.attribute] = groupItem.value;
        groupItem.processed = true;
      });

      trail = trails[target.parentPath];

      // set up first node, everythign else should have parent path
      if (!trail) {
        trail = _.findWhere(translated, blueprint);
        if (!trail) {
          trail = blueprint;
          translated.push(blueprint);
        }
        trails[target.parentPath] = trail;
      }

      // trail is now at parent node, standing by for current node injection
      if (target.node) { // should skip root because '' resolves to false
        var isCollection = target.node === _.pluralize(target.node);
        var node = trail[target.node] = (trail[target.node] || (isCollection ? [blueprint] : blueprint));

        if (isCollection) {
          node = _.findWhere(trail[target.node], blueprint);
          if (!node) {
            node = blueprint;
            trail[target.node].push(node);
          }
        }

        trails[target.fullPath] = node;
      }
    }
  });

  return translated;
}

exports.grow = function(rows, config) {
  return expand(rows, config);
};

exports.set = function(config) {
  _.extend(options, config);
};
