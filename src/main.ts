import {createApp} from 'vue'
import './style.css'
import App from './App.vue'
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Aura from '@primeuix/themes/aura';
import Vue3TouchEvents, {type Vue3TouchEventsOptions} from "vue3-touch-events";

createApp(App)
    .use(PrimeVue, {
        theme: {
            preset: Aura
        }
    })
    .use<Vue3TouchEventsOptions>(Vue3TouchEvents, {})
    .use(ToastService)
    .mount('#app')
