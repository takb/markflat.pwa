<script setup lang="ts">
    import { ref, computed } from 'vue';
    import { FilterMatchMode } from '@primevue/core/api';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Button from 'primevue/button';
    import ToggleSwitch from 'primevue/toggleswitch';
    import InputText from 'primevue/inputtext';
    import IconField from 'primevue/iconfield';
    import InputIcon from 'primevue/inputicon';
    import { store } from '../composables/store.ts';
    import useSizes from '../composables/sizes.ts';
    const editMode = ref(false);
    const filters = ref({ global: { value: null, matchMode: FilterMatchMode.CONTAINS } });
    const sizes = useSizes();
    const panelCss = computed(() => {
      return sizes.isMobile.value ? 'h-full w-full' : 'h-full w-8/12 ml-auto mr-auto'
    })
</script>

<template>
  <p>{{ sizes.isMobile }}</p>
    <DataTable :value="store.songbook"  v-model:filters="filters" :class="panelCss" :scrollable="true" stripedRows removableSort dataKey="id">
        <template #header>
            <div class="flex justify-between">
                <Button><i class="pi pi-megaphone"></i></Button>
                <IconField>
                    <InputIcon>
                        <i class="pi pi-search" />
                    </InputIcon>
                    <InputText v-model="filters['global'].value" placeholder="Keyword Search" />
                </IconField>
            </div>
        </template>
        <template #empty> No songs found. </template>
        <Column field="title" header="Title" class="p-2" sortable />
        <Column field="author" header="Composer/Interpret" sortable />
        <Column>
            <template #header>
                Edit <ToggleSwitch v-model="editMode" />
            </template>
            <template #body="slotProps" v-if="editMode">
                <Button icon="pi pi-pencil" rounded raised @click="() => store.edit(slotProps.data)" class="mr-2" />
                <Button icon="pi pi-trash" rounded raised @click="() => store.delete(slotProps.data)"/>
            </template>
        </Column>
    </DataTable>
</template> 
