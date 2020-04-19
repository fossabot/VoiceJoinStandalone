import Vue from 'vue'
import Router from 'vue-router'
import AgoraRTC from 'agora-rtc-sdk'

import App from './App.vue'
import router from './router'
import store from './store/index'
import ViewUI from 'view-design'
import 'view-design/dist/styles/iview.css'
import VueAPI from './plugins/VueAPI'

const isDev = process.env.NODE_ENV === 'development'

Vue.config.devtools = isDev
Vue.config.performance = isDev
Vue.config.productionTip = isDev

Vue.use(Router)
Vue.use(ViewUI)
Vue.use(VueAPI)

// eslint-disable-next-line no-new
window._ClientVueRoot = new Vue({
  components: { App },
  router: new Router(router()),
  store,
  template: '<App/>'
}).$mount('#app')

window.AgoraRTC = AgoraRTC
