import {
  defineConfig,
  transformWithEsbuild,
  loadEnv,
  type PluginOption,
} from 'vite'
import react from '@vitejs/plugin-react-swc'
import EnvironmentPlugin from 'vite-plugin-environment'
import { visualizer } from 'rollup-plugin-visualizer'
import sass from 'sass'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }
  return {
    // Relative asset URLs so one build serves at "/" (dev/prod S3+CloudFront)
    // and under a path prefix like /pr/<repo>/<n>/ in a PR environment
    // (ztmf-misc#351). Safe with the hash router: the document path never
    // changes after load, so relative resolution is stable on every route.
    base: './',
    define: {
      'process.env': {},
      global: {},
      _global: {},
    },

    resolve: {
      alias: {
        '@': '/src',
        'npm:': '/node_modules/',
      },
    },

    css: {
      preprocessorOptions: {
        scss: {
          implementation: sass,
        },
      },
    },
    plugins: [
      react(),
      // Only NODE_ENV is read via process.env in src (main.tsx); app config
      // comes through vite-native import.meta.env.VITE_*. 'all' would let a
      // build bake arbitrary variables from the CI runner's environment into
      // the bundle (ztmf-misc#351).
      EnvironmentPlugin(['NODE_ENV']),
      // @ts-ignore-next-line
      visualizer() as PluginOption,
      {
        name: 'load+transform-js-files-as-jsx',
        async transform(code, id) {
          if (!id.match(/src\/.*\.js$/)) {
            return null
          }
          return transformWithEsbuild(code, id, {
            loader: 'jsx',
            jsx: 'automatic',
          })
        },
      },
    ],

    server: {
      host: true,
      port: 5174,
      proxy: {
        '/api/v1': {
          target: process.env.VITE_CF_DOMAIN,
          changeOrigin: true,
          secure: false,
        },
        '/whoami': {
          target: process.env.VITE_CF_DOMAIN,
          changeOrigin: true,
          secure: false,
        },
      },
      watch: {
        ignored: ['**/coverage/**'],
      },
    },

    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },

    ...(mode === 'development' && {
      build: {
        sourcemap: true,
        minify: false,
      },
    }),
  }
})
