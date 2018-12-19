module.exports = {
    devServer: {
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
            },
            '/event-bus': {
                target: 'http://localhost:4000',
                ws: true,
                changeOrigin: true
            }
        }
    }
}