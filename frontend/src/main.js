import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store/store'
import Highcharts from "highcharts";
import Stock from "highcharts/modules/stock";
import HighchartsVue from "highcharts-vue";
Stock(Highcharts);
Vue.use(HighchartsVue);

Vue.config.productionTip = false

window.app = new Vue({
  router,
  store,
  render: function (h) { return h(App) }
}).$mount('#app')
