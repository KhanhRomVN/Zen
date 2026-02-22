//@ts-check

"use strict";

const path = require("path");

/**@type {import('webpack').Configuration}*/
const config = {
  target: "node",
  entry: {
    extension: "./src/extension.ts",
    TerminalBridge: "./src/managers/TerminalBridge.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode",
    "node-pty": "commonjs node-pty",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /webview-ui/],
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.extension.json",
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new (require("copy-webpack-plugin"))({
      patterns: [
        {
          from: "node_modules/shiki/dist/onig.wasm",
          to: "onig.wasm",
        },
        {
          from: "node_modules/shiki/dist/langs",
          to: "langs",
        },
        {
          from: "node_modules/shiki/dist/themes",
          to: "themes",
        },
      ],
    }),
  ],
};

module.exports = config;
