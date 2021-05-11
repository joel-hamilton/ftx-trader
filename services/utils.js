module.exports = {
    wait(duration) {
        return new Promise(res => setTimeout(res, duration));
    }
}