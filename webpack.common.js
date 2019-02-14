const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackIncludeAssetsPlugin = require('html-webpack-include-assets-plugin');


module.exports = {
    externals: {
        react: 'React',
        'react-dom': 'ReactDOM',
    },
    resolve: {
        extensions: ['.ts', '.tsx'],
    },
    entry: "./src/index.tsx",
    output: {
        path: path.resolve(__dirname, "static"),
        publicPath: "/s",
        filename: "s.js",
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx|js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            }
        ]
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            memoryLimit: 256,
        }),
        new CopyPlugin([{
            from: 'src/static',
            dest: '.',
            ignore: '.*',
            transform (content, path) {
                if (path.endsWith(".css")) {
                    return content.toString().replace(/(\s)\s+/g, '$1')
                }
                return content
            }
        }]),
        new HtmlWebpackPlugin({
            template: 'src/index.html',
            inject: 'head',
            hash: true,
        }),
        new ScriptExtHtmlWebpackPlugin({
            defaultAttribute: 'defer',
        }),
        new HtmlWebpackIncludeAssetsPlugin({
            assets: ['s.css'],
            append: false,
            hash: true,
        }),
        new CompressionPlugin({
            test: /\.(js|css|html|svg)(\?.*)?$/i,
            cache: true
        }),
    ]
};
