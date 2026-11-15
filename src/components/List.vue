<script setup lang="ts">
    import { ref, computed } from 'vue'
    import { FilterMatchMode } from '@primevue/core/api'
    import { useToast } from 'primevue/usetoast'
    import DataTable, { type DataTableRowClickEvent } from 'primevue/datatable'
    import Column from 'primevue/column'
    import Button from 'primevue/button'
    import Dialog from 'primevue/dialog'
    import InputText from 'primevue/inputtext'
    import IconField from 'primevue/iconfield'
    import InputIcon from 'primevue/inputicon'
    import Menu from 'primevue/menu'

    import store from '../composables/store.ts'
    import { API_URL } from '../composables/api.ts'
    import useSizes from '../composables/sizes.ts'

    const toast = useToast()
    const editMode = ref(false)
    const filters = ref({ global: { value: null, matchMode: FilterMatchMode.CONTAINS } })
    const menu = ref()
    const settings = ref(false)
    const sizes = useSizes()
    const panelCss = computed(() => {
      return sizes.isMobile.value ? 'h-full w-full' : 'h-full w-8/12 ml-auto mr-auto'
    })
    const toggle = (event: Event) => {
      menu.value.toggle(event)
    }
    const viewSong = (event: DataTableRowClickEvent) => {
      store.show(event.data.id)
    }
    const items = ref([
      {
        label: 'Edit mode',
        icon: 'pi pi-pencil',
        command: () => {
          editMode.value = !editMode.value
        },
      },
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () => {
          settings.value = true
        },
      },
      {
        label: 'Download songbook',
        icon: 'pi pi-replay',
        command: () => {
          fetch(API_URL, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: 'key=' + store.apiKeyRead,
            })
            .then(res => {
              res.json().then(value => {
                if (value.status === 'error') {
                  toast.add({ severity: value.status, summary: value.title, detail: value.message, life: 3000 })
                  return
                }
                store.songbook = []
                let id = 0
                value.forEach((song: { title: string, artist: string, md: string }) => {
                  store.songbook.push({
                    id: id++,
                    title: song.title,
                    artist: song.artist,
                    content: song.md,
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
        },
      },
    ])
</script>

<template>
  <div>
    <DataTable v-model:filters="filters" :value="store.songbook" :global-filter-fields="['title', 'artist', 'content']" sort-field="title" :sort-order="1" :class="panelCss" scrollable scroll-height="flex" striped-rows removable-sort data-key="id" @row-click="viewSong">
        <template #header>
            <div class="flex justify-between">
              <Button type="button" icon="pi pi-ellipsis-v" aria-haspopup="true" aria-controls="overlay_menu" @click="toggle" />
              <Menu id="overlay_menu" ref="menu" :model="items" :popup="true" />
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
        <Column v-if="editMode">
            <template #header>
              <Button icon="pi pi-plus" rounded raised class="mr-2" @click="() => store.addSong()" />
            </template>
            <template #body="slotProps">
              <Button icon="pi pi-pencil" rounded raised class="mr-2" @click="() => store.edit(slotProps.data.id)" />
            </template>
        </Column>
    </DataTable>
    <Dialog v-model:visible="settings" modal header="API settings" :style="{ width: '25rem' }">
      <div class="flex items-center gap-4 mb-4">
        <label for="username" class="font-semibold w-24">Read Key</label>
        <InputText id="readKey" v-model="store.apiKeyRead" type="password" class="flex-auto" autocomplete="off" />
      </div>
      <div class="flex items-center gap-4 mb-8">
        <label for="username" class="font-semibold w-24">Write Key</label>
        <InputText id="writeKey" v-model="store.apiKeyWrite" type="password" class="flex-auto" autocomplete="off" />
      </div>
      <div class="flex justify-end gap-2">
        <Button type="button" label="Cancel" severity="secondary" @click="store.loadApiKeys(); settings = false"></Button>
        <Button type="button" label="Save" @click="store.saveApiKeys(); settings = false"></Button>
      </div>
    </Dialog>
  </div>
</template> 
