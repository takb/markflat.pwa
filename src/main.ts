import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import {createRouter, createWebHistory} from 'vue-router'
import List from '@/views/List.vue'
import Editor from '@/views/Editor.vue'
import Show from '@/views/Show.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {path: '/', name: 'List', component:List},
    {path: '/edit', name: 'Edit', component:Editor},
    {path: '/show', name: 'Show', component:Show}
  ]
})

createApp(App)
  .use(router)
  .use(PrimeVue, {
    theme: {
        preset: Aura
    }
  })
  .mount('#app')
