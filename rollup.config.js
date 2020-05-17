import pkg from './package.json'
import { terser } from 'rollup-plugin-terser'
import json from '@rollup/plugin-json'

export default {
  input: 'src/index.js', // our source file
  output: [
    {
      file: pkg.main,
      format: 'cjs',
    },
    {
      file: pkg.module,
      format: 'es', // the preferred format
    },
  ],
  plugins: [
    // terser() // minifies generated bundles
    json(), // minifies generated bundles
  ],
}
