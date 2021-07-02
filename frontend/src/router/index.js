import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Rebalance',
    component: function () {
        return import('../views/Rebalance.vue')
    }
  },
  {
    path: '/api',
    name: 'API',
    component: function () {
        return import('../views/API.vue')
    }
  },
  {
    path: '/twitter',
    name: 'Twitter',
    component: function () {
        return import('../views/Twitter.vue')
    }
  },
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
