import pkg from './package.json'
import json from '@rollup/plugin-json'
import { terser } from 'rollup-plugin-terser'
import sourcemaps from 'rollup-plugin-sourcemaps'

export default {
  input: 'src/index.js', // our source file
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'es', // the preferred format
      sourcemap: true,
    },
  ],
  plugins: [
    sourcemaps(),
    // terser() // minifies generated bundles
    json(), // minifies generated bundles
  ],
}
