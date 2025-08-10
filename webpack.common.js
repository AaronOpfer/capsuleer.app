const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    cache: {type: "filesystem"},
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    entry: "./src/index.tsx",
    output: {
        path: path.resolve(__dirname, "static"),
        publicPath: "/s/",
        filename: "s.js?[contenthash]",
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, "css-loader"]
            },
			{
				test: /\.html$/,
				use: 'html-loader'
			},
            {
                test: /\.(ts|tsx|js|jsx)$/,
                exclude: /node_modules/,
                use: 'babel-loader'
            },
            {
                test: /\.(png|jpe?g|gif|svg|webp|ico)$/i,
                type: 'asset/resource',
                generator: {filename: '[name][ext]?[contenthash]'}
            }
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: "[name].css?[contenthash]"
        }),
        new ForkTsCheckerWebpackPlugin({
            typescript: {memoryLimit: 256}
        }),
        new HtmlWebpackPlugin({
            favicon: 'src/static/favicon.ico',
            template: 'src/index.html',
            inject: 'head'
        }),
        new CompressionPlugin({
            test: /\.(js|css|html|svg|ico)(\?.*)?$/i,
        }),
    ]
};
