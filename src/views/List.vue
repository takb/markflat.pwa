<script setup lang="ts">
    import { ref } from 'vue';
    import { FilterMatchMode } from '@primevue/core/api';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Button from 'primevue/button';
    import ToggleSwitch from 'primevue/toggleswitch';
    import InputText from 'primevue/inputtext';
    import IconField from 'primevue/iconfield';
    import InputIcon from 'primevue/inputicon';
    const checked = ref(false);
    const props = defineProps({
        songbook:Array,
        selected:Number
    })
    const filters = ref({ global: { value: null, matchMode: FilterMatchMode.CONTAINS } });
</script>

<template>
    <DataTable :value="songbook"  v-model:filters="filters" class="h-full w-full" :scrollable="true" stripedRows removableSort dataKey="id">
        <template #header>
            <div class="flex justify-end">
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
                Edit <ToggleSwitch v-model="checked" />
            </template>
            <template #body="slotProps" v-if="checked">
                <Button icon="pi pi-trash" rounded raised @click="() => songbook?.splice(songbook.indexOf(slotProps.data), 1)" />
                <Button icon="pi pi-pencil" rounded raised @click="() => {
                    $emit('changeSelected', slotProps.data); 
                    $router.push({ path: 'edit'})
                    }" />
            </template>
        </Column>
    </DataTable>
</template> 
