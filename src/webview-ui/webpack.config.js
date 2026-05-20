const path = require("path");

module.exports = {
  // Make webpack output use paths relative to this folder in logs/errors
  context: __dirname,
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "webview.js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  module: {
    rules: [
      {
        test: /.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "tsconfig.json"),
            compilerOptions: {
              jsx: "react-jsx",
              lib: ["ES2020", "DOM", "DOM.Iterable"],
              target: "ES2020",
              module: "ESNext",
              moduleResolution: "bundler",
              allowJs: true,
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
              allowSyntheticDefaultImports: true,
              noEmit: false,
              isolatedModules: true,
            },
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              esModule: false,
              sourceMap: false,
              importLoaders: 1,
            },
          },
          "postcss-loader",
        ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
      },
    ],
  },
  plugins: [],
  devtool: process.env.NODE_ENV === "production" ? false : "source-map",
  performance: {
    hints: false,
  },
  stats: {
    context: __dirname,
    colors: true,
  },
  // Disable code splitting to avoid CSP issues in VS Code webview
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
};
