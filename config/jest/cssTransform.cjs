// This is a custom Jest transformer turning style imports into empty objects.

module.exports = {
  process() {
    // Jest expects transformed source under the `code` key.
    return { code: 'module.exports = {};' }
  },
  getCacheKey() {
    // The output is always the same.
    return 'cssTransform'
  },
}
