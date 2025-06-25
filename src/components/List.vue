<script setup lang="ts">
    import { ref, computed } from 'vue'
    import { FilterMatchMode } from '@primevue/core/api'
    import { useToast } from 'primevue/usetoast';
    import DataTable from 'primevue/datatable'
    import Column from 'primevue/column'
    import Button from 'primevue/button'
    import Dialog from 'primevue/dialog'
    import InputText from 'primevue/inputtext'
    import IconField from 'primevue/iconfield'
    import InputIcon from 'primevue/inputicon'
    import Menu from 'primevue/menu'

    import store from '../composables/store.ts'
    import useSizes from '../composables/sizes.ts'

    const toast = useToast();
    const editMode = ref(true)
    const filters = ref({ global: { value: null, matchMode: FilterMatchMode.CONTAINS } })
    const menu = ref()
    const settings = ref(false);
    const sizes = useSizes()
    const panelCss = computed(() => {
      return sizes.isMobile.value ? 'h-full w-full' : 'h-full w-8/12 ml-auto mr-auto'
    })
    const toggle = (event: Event) => {
      menu.value.toggle(event)
    }
    const viewSong = (event: any) => {
      store.show(event.data.id)
    }
    const items = ref([
      {
        label: 'Edit mode',
        icon: 'pi pi-pencil',
        command: () => {
          editMode.value = !editMode.value
        }
      },
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () => {
          settings.value = true
        }
      },
      {
        label: 'Download songbook',
        icon: 'pi pi-replay',
        command: () => {
          fetch("https://www.genkidelic.de/songbook.php")
              .then(res => {
                res.json().then(value => {
                  store.songbook = []
                  let id = 0
                  value.forEach((song: any) => {
                    store.songbook.push({
                      id: id++,
                      title: song.title,
                      artist: song.artist,
                      content: song.md
                    })
                  })
                  store.saveSongbook()
                  toast.add({ severity: 'success', summary: 'Download completed', detail: 'Successfully imported ' + id + ' songs.', life: 3000 })
                })
              })
              .catch(err => {
                console.error(err)
                toast.add({ severity: 'error', summary: 'Download failed', detail: 'Could not download songbook.', life: 3000 })
              })
        }
      }
    ])
</script>

<template>
  <div>
    <DataTable :value="store.songbook"  v-model:filters="filters" :globalFilterFields="['title', 'artist', 'content']" sortField="title" :sortOrder="1" :class="panelCss" scrollable scroll-height="flex" stripedRows removableSort dataKey="id" @row-click="viewSong">
        <template #header>
            <div class="flex justify-between">
              <Button type="button" icon="pi pi-ellipsis-v" @click="toggle" aria-haspopup="true" aria-controls="overlay_menu" />
              <Menu ref="menu" id="overlay_menu" :model="items" :popup="true" />
              <IconField>
                  <InputIcon>
                      <i class="pi pi-search" />
                  </InputIcon>
                  <InputText v-model="filters['global'].value" placeholder="Keyword Search" />
              </IconField>
            </div>
        </template>
        <template #empty> No songs found. </template>
        <Column field="title" header="Title" class="p-2 flex-grow" sortable />
        <Column field="artist" header="Composer/Interpret" sortable />
        <Column>
            <template #header="_slotProps" v-if="editMode">
              <Button icon="pi pi-plus" rounded raised @click="() => store.addSong()" class="mr-2" />
            </template>
            <template #body="slotProps" v-if="editMode">
              <Button icon="pi pi-pencil" rounded raised @click="() => store.edit(slotProps.data.id)" class="mr-2" />
            </template>
        </Column>
    </DataTable>
    <Dialog v-model:visible="settings" modal header="API settings" :style="{ width: '25rem' }">
      <div class="flex items-center gap-4 mb-4">
        <label for="username" class="font-semibold w-24">Read Key</label>
        <InputText type="password" id="readKey" class="flex-auto" v-model="store.apiKeyRead" autocomplete="off" />
      </div>
      <div class="flex items-center gap-4 mb-8">
        <label for="username" class="font-semibold w-24">Write Key</label>
        <InputText type="password" id="writeKey" class="flex-auto" v-model="store.apiKeyWrite" autocomplete="off" />
      </div>
      <div class="flex justify-end gap-2">
        <Button type="button" label="Cancel" severity="secondary" @click="store.loadApiKeys(); settings = false"></Button>
        <Button type="button" label="Save" @click="store.saveApiKeys(); settings = false"></Button>
      </div>
    </Dialog>
  </div>
</template> 
