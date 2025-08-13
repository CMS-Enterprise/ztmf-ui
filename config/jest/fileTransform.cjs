const path = require('path')

// This is a custom Jest transformer turning file imports into filenames.

module.exports = {
  process(src, filename) {
    const assetFilename = JSON.stringify(path.basename(filename))

    if (filename.match(/\.svg$/)) {
      // Based on how SVGR generates a component name:
      const pascalCaseFilename = path
        .basename(filename, '.svg')
        .replace(/(\w)/, (_, firstLetter) => firstLetter.toUpperCase())
      const componentName = `Svg${pascalCaseFilename}`
      return `const React = require('react');
      module.exports = {
        __esModule: true,
        default: ${assetFilename},
        ReactComponent: React.forwardRef(function ${componentName}(props, ref) {
          return {
            $$typeof: Symbol.for('react.element'),
            type: 'svg',
            ref: ref,
            key: null,
            props: Object.assign({}, props, {
              children: ${assetFilename}
            })
          };
        }),
      };`
    }

    return `module.exports = ${assetFilename};`
  },
}
