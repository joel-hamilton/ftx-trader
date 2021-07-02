import Vue from 'vue';
import Vuex from 'vuex';

const { context, modules } = loadModules()
Vue.use(Vuex);

let store = new Vuex.Store({
    modules,
    strict: process.env.NODE_ENV !== 'production'
});

if (module.hot) {
    // Hot reload whenever any module changes.
    module.hot.accept(context.id, () => {
        const { modules } = loadModules()

        store.hotUpdate({
            modules
        })
    })
}

function loadModules() {
    const context = require.context('./modules', false, /\.store\.js$/);
    const modules = {};

    // import all .store.js modules as eg: session.store.js => session
    context.keys().forEach(filename => {
        const moduleName = filename.replace(/(\.\/|\.store\.js)/g, '');
        modules[moduleName] = context(filename).default || context(filename);
    });

    return { context, modules }
}

export default store;