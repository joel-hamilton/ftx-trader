async function wait(timeout = 0) {
    return new Promise(res => setTimeout(res, timeout));
}
module.exports = {
    wait,
}