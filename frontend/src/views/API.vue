<template>
    <div>
        <h2>API</h2>
        <div>
            <input type="text" v-model="getParams" placeholder="get params" @keypress.enter="ftxGet" />
            <label>Auth Route<input type="checkbox" v-model="authRoute" /></label>
            <button @click="ftxGet">FTX GET</button>
        </div>
        <div class="json" v-html="res" v-if="res"></div>
    </div>
</template>

<script>
    const axios = require('axios');
    export default {
        name: 'API',
        data() {
            return {
                authRoute: false,
                getParams: '',
                res: null,
            };
        },
        computed: {},
        methods: {
            async ftxGet() {
                let url;
                if (this.authRoute) {
                    url = `http://localhost:3000/ftx/getAuth/${encodeURIComponent(this.getParams)}`;
                } else {
                    url = `http://localhost:3000/ftx/get/${encodeURIComponent(this.getParams)}`;
                }
                let res = await axios.get(url); 
                this.res = this.$store.getters['base/syntaxHighlight'](res.data);
            },
        },
    };
</script>
