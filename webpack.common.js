const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackTagsPlugin = require('html-webpack-tags-plugin');


module.exports = {
    cache: {type: "filesystem"},
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
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
            typescript: {memoryLimit: 256}
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: 'src/static',
                    to: '.',
                    globOptions: {dot: true},
                    transform (content, path) {
                        if (path.endsWith(".css")) {
                            return content.toString().replace(/(\s)\s+/g, '$1')
                        }
                        return content
                    }
                }
            ]
        }),
        new HtmlWebpackPlugin({
            template: 'src/index.html',
            inject: 'head',
            hash: true,
        }),
        new HtmlWebpackTagsPlugin({
            tags: ['s.css'],
            append: false,
            hash: true,
        }),
        new CompressionPlugin({
            test: /\.(js|css|html|svg)(\?.*)?$/i,
        }),
    ]
};
