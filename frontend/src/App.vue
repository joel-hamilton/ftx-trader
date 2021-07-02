<template>
    <div id="app">
        <div id="nav">
            <router-link to="/">Rebalance</router-link> | <router-link to="/api">API Testing</router-link> |
            <router-link to="/twitter">Twitter</router-link>
        </div>
        <router-view id="main" />
    </div>
</template>

<style lang="scss">
    html {
        box-sizing: border-box;
    }

    *,
    *:before,
    *:after {
        box-sizing: inherit;
    }
    
    body {
        height: 100%;
        height: 100vh;
        margin-top: 0;
        margin-bottom: 0;
    }

    #app {
        font-family: Avenir, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        color: #2c3e50;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    #nav {
        text-align: center;
        padding: 30px;

        a {
            font-weight: bold;
            color: #2c3e50;

            &.router-link-exact-active {
                color: #42b983;
            }
        }
    }

    #main {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .json,
    .search-res,
    .diff {
        white-space: pre-wrap;
        font-family: 'Courier New', Courier, monospace;
        outline: 1px solid #ccc;
        padding: 5px;
        margin: 5px;
    }

    .analyze-res {
        display: grid;
        grid-template-columns: 50% 50%;
    }

    .analyze-result {
        margin-top: 2em;
        padding: 2em;
        box-sizing: border-box;
    }

    .string {
        color: green;
    }

    .number {
        color: darkorange;
    }

    .boolean {
        color: blue;
    }

    .null {
        color: magenta;
    }

    .key {
        color: red;
    }
</style>
