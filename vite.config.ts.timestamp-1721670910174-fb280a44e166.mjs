// vite.config.ts
import {
  defineConfig,
  transformWithEsbuild,
} from 'file:///Users/m31973/Documents/CMS-main/ztmf/ui/node_modules/vite/dist/node/index.js'
import react from 'file:///Users/m31973/Documents/CMS-main/ztmf/ui/node_modules/@vitejs/plugin-react-swc/index.mjs'
import EnvironmentPlugin from 'file:///Users/m31973/Documents/CMS-main/ztmf/ui/node_modules/vite-plugin-environment/dist/index.js'
import { visualizer } from 'file:///Users/m31973/Documents/CMS-main/ztmf/ui/node_modules/rollup-plugin-visualizer/dist/plugin/index.js'
import sass from 'file:///Users/m31973/Documents/CMS-main/ztmf/ui/node_modules/sass/sass.node.mjs'
var vite_config_default = defineConfig(({ mode }) => {
  return {
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
      EnvironmentPlugin('all'),
      // @ts-ignore-next-line
      visualizer(),
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
        '/graphql': {
          target: 'http://localhost:3000/',
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
export { vite_config_default as default }
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvbTMxOTczL0RvY3VtZW50cy9DTVMtbWFpbi96dG1mL3VpXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvbTMxOTczL0RvY3VtZW50cy9DTVMtbWFpbi96dG1mL3VpL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9Vc2Vycy9tMzE5NzMvRG9jdW1lbnRzL0NNUy1tYWluL3p0bWYvdWkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIHRyYW5zZm9ybVdpdGhFc2J1aWxkLCB0eXBlIFBsdWdpbk9wdGlvbiB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djJ1xuaW1wb3J0IEVudmlyb25tZW50UGx1Z2luIGZyb20gJ3ZpdGUtcGx1Z2luLWVudmlyb25tZW50J1xuaW1wb3J0IHsgdmlzdWFsaXplciB9IGZyb20gJ3JvbGx1cC1wbHVnaW4tdmlzdWFsaXplcidcbmltcG9ydCBzYXNzIGZyb20gJ3Nhc3MnXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIHJldHVybiB7XG4gICAgZGVmaW5lOiB7XG4gICAgICAncHJvY2Vzcy5lbnYnOiB7fSxcblxuICAgICAgZ2xvYmFsOiB7fSxcbiAgICAgIF9nbG9iYWw6IHt9LFxuICAgIH0sXG5cbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICAnQCc6ICcvc3JjJyxcbiAgICAgICAgJ25wbTonOiAnL25vZGVfbW9kdWxlcy8nLFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgY3NzOiB7XG4gICAgICBwcmVwcm9jZXNzb3JPcHRpb25zOiB7XG4gICAgICAgIHNjc3M6IHtcbiAgICAgICAgICBpbXBsZW1lbnRhdGlvbjogc2FzcyxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBwbHVnaW5zOiBbXG4gICAgICByZWFjdCgpLFxuICAgICAgRW52aXJvbm1lbnRQbHVnaW4oJ2FsbCcpLFxuICAgICAgLy8gQHRzLWlnbm9yZS1uZXh0LWxpbmVcbiAgICAgIHZpc3VhbGl6ZXIoKSBhcyBQbHVnaW5PcHRpb24sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdsb2FkK3RyYW5zZm9ybS1qcy1maWxlcy1hcy1qc3gnLFxuICAgICAgICBhc3luYyB0cmFuc2Zvcm0oY29kZSwgaWQpIHtcbiAgICAgICAgICBpZiAoIWlkLm1hdGNoKC9zcmNcXC8uKlxcLmpzJC8pKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJhbnNmb3JtV2l0aEVzYnVpbGQoY29kZSwgaWQsIHtcbiAgICAgICAgICAgIGxvYWRlcjogJ2pzeCcsXG4gICAgICAgICAgICBqc3g6ICdhdXRvbWF0aWMnLFxuICAgICAgICAgIH0pXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0sXG5cbiAgICBzZXJ2ZXI6IHtcbiAgICAgIGhvc3Q6IHRydWUsXG4gICAgICBwb3J0OiA1MTc0LFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgJy9ncmFwaHFsJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC8nLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHdhdGNoOiB7XG4gICAgICAgIGlnbm9yZWQ6IFsnKiovY292ZXJhZ2UvKionXSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgIG9wdGltaXplRGVwczoge1xuICAgICAgZXNidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgbG9hZGVyOiB7XG4gICAgICAgICAgJy5qcyc6ICdqc3gnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgLi4uKG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiYge1xuICAgICAgYnVpbGQ6IHtcbiAgICAgICAgc291cmNlbWFwOiB0cnVlLFxuICAgICAgICBtaW5pZnk6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9KSxcbiAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFMsU0FBUyxjQUFjLDRCQUErQztBQUNoWCxPQUFPLFdBQVc7QUFDbEIsT0FBTyx1QkFBdUI7QUFDOUIsU0FBUyxrQkFBa0I7QUFDM0IsT0FBTyxVQUFVO0FBR2pCLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFNBQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxNQUNOLGVBQWUsQ0FBQztBQUFBLE1BRWhCLFFBQVEsQ0FBQztBQUFBLE1BQ1QsU0FBUyxDQUFDO0FBQUEsSUFDWjtBQUFBLElBRUEsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSztBQUFBLFFBQ0wsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsSUFFQSxLQUFLO0FBQUEsTUFDSCxxQkFBcUI7QUFBQSxRQUNuQixNQUFNO0FBQUEsVUFDSixnQkFBZ0I7QUFBQSxRQUNsQjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxNQUFNO0FBQUEsTUFDTixrQkFBa0IsS0FBSztBQUFBO0FBQUEsTUFFdkIsV0FBVztBQUFBLE1BQ1g7QUFBQSxRQUNFLE1BQU07QUFBQSxRQUNOLE1BQU0sVUFBVSxNQUFNLElBQUk7QUFDeEIsY0FBSSxDQUFDLEdBQUcsTUFBTSxjQUFjLEdBQUc7QUFDN0IsbUJBQU87QUFBQSxVQUNUO0FBQ0EsaUJBQU8scUJBQXFCLE1BQU0sSUFBSTtBQUFBLFlBQ3BDLFFBQVE7QUFBQSxZQUNSLEtBQUs7QUFBQSxVQUNQLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUVBLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxRQUNMLFlBQVk7QUFBQSxVQUNWLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUEsTUFDRjtBQUFBLE1BQ0EsT0FBTztBQUFBLFFBQ0wsU0FBUyxDQUFDLGdCQUFnQjtBQUFBLE1BQzVCO0FBQUEsSUFDRjtBQUFBLElBRUEsY0FBYztBQUFBLE1BQ1osZ0JBQWdCO0FBQUEsUUFDZCxRQUFRO0FBQUEsVUFDTixPQUFPO0FBQUEsUUFDVDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFFQSxHQUFJLFNBQVMsaUJBQWlCO0FBQUEsTUFDNUIsT0FBTztBQUFBLFFBQ0wsV0FBVztBQUFBLFFBQ1gsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
