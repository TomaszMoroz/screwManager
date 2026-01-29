<template>
  <q-page class="q-pa-md">
    <h2>Reyher Config</h2>
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Wgraj plik CSV</div>
        <q-uploader
          label="Wybierz plik CSV"
          accept=".csv"
          @added="onFileAdded"
          :auto-upload="false"
          :hide-upload-btn="true"
          :hide-upload-progress="true"
        />
        <div v-if="csvFileName" class="q-mt-md">
          <q-banner dense class="bg-green-1 text-green-10">
            Plik <b>{{ csvFileName }}</b> został załadowany.
          </q-banner>
        </div>
      </q-card-section>
    </q-card>
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Definiowanie grup (Norma + Materiał + Pokrycie)</div>
        <div class="row q-mb-md">
          <q-select
            v-model="newGroup.norma"
            :options="normaOptions"
            label="Norma (6 znaków)"
            class="col-4 q-mr-sm"
            emit-value
            map-options
          />
          <q-select
            v-model="newGroup.material"
            :options="materialOptions"
            label="Materiał (2 znaki)"
            class="col-4 q-mr-sm"
            :disable="!newGroup.norma"
            emit-value
            map-options
          />
          <q-select
            v-model="newGroup.pokrycie"
            :options="pokrycieOptions"
            label="Pokrycie (3 znaki)"
            class="col-4"
            :disable="!newGroup.material"
            emit-value
            map-options
          />
          <q-btn color="primary" label="Dodaj" class="q-ml-md" @click="addGroup" :disable="!canAddGroup" />
        </div>
        <q-table
          title="Grupy"
          :rows="groupList"
          :columns="columns"
          row-key="id"
          selection="multiple"
          v-model:selected="selectedRows"
          :filter="tableFilter"
        >
          <template v-slot:top-right>
            <q-input dense debounce="300" v-model="tableFilter" placeholder="Filtruj..." />
            <q-btn flat color="negative" icon="delete" label="Usuń zaznaczone" class="q-ml-sm" @click="removeSelected" :disable="!selectedRows.length" />
            <q-btn flat color="secondary" icon="playlist_add" label="Dodaj do pobrania" class="q-ml-sm" @click="addToDownloadList" :disable="!selectedRows.length" />
          </template>
          <template v-slot:body-cell-actions="props">
            <q-td align="center">
              <q-btn size="sm" flat icon="edit" color="primary" @click="editGroup(props.row)" />
              <q-btn size="sm" flat icon="delete" color="negative" @click="removeGroup(props.row)" />
            </q-td>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useReyherConfigStore } from 'src/stores/reyherConfigStore'

const store = useReyherConfigStore()
const csvData = ref(store.csvData)
const csvFileName = ref('')
const groupList = ref([])
const selectedRows = ref([])
const tableFilter = ref('')


const newGroup = ref({ norma: '', material: '', pokrycie: '' })


const normaOptions = computed(() => {
  // Unikalne pierwsze 6 znaków z każdego SKU
  const set = new Set(csvData.value.map(v => v.slice(0, 6)).filter(v => v.length === 6))
  return Array.from(set)
})

const materialOptions = computed(() => {
  if (!newGroup.value.norma) return []
  // Unikalne 2 znaki po normie (pozycje 6-8)
  const set = new Set(
    csvData.value
      .filter(v => v.startsWith(newGroup.value.norma))
      .map(v => v.slice(6, 8))
      .filter(v => v.length === 2)
  )
  return Array.from(set)
})

const pokrycieOptions = computed(() => {
  if (!newGroup.value.norma || !newGroup.value.material) return []
  // Unikalne 3 znaki po materiale (pozycje 8-11)
  const set = new Set(
    csvData.value
      .filter(v => v.startsWith(newGroup.value.norma + newGroup.value.material))
      .map(v => v.slice(8, 11))
      .filter(v => v.length === 3)
  )
  return Array.from(set)
})

const columns = [
  { name: 'norma', label: 'Norma', field: 'norma', align: 'left', sortable: true },
  { name: 'material', label: 'Materiał', field: 'material', align: 'left', sortable: true },
  { name: 'pokrycie', label: 'Pokrycie', field: 'pokrycie', align: 'left', sortable: true },
  { name: 'actions', label: 'Akcje', field: 'actions', align: 'center' }
]

function onFileAdded(files) {
  if (!files.length) return
  const file = files[0]
  csvFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target.result
    const rows = text.split(/\r?\n/)
    // Pobierz tylko pierwszą kolumnę z każdej linii, pomijając puste
    const values = rows.map(row => row.split(';')[0].trim()).filter(Boolean)
    csvData.value = values
    store.setCsvData(values)
  }
  reader.readAsText(file)
}

function filterOptions(val, update) {
  update(() => {
    // Można dodać własne filtrowanie jeśli potrzeba
  })
}

const canAddGroup = computed(() => {
  return newGroup.value.norma && newGroup.value.material && newGroup.value.pokrycie
})

function addGroup() {
  if (!canAddGroup.value) return
  groupList.value.push({
    id: Date.now() + Math.random(),
    norma: newGroup.value.norma,
    material: newGroup.value.material,
    pokrycie: newGroup.value.pokrycie
  })
  newGroup.value = { norma: '', material: '', pokrycie: '' }
  saveGroups()
}

function removeGroup(row) {
  groupList.value = groupList.value.filter(g => g.id !== row.id)
  saveGroups()
}

function removeSelected() {
  const ids = selectedRows.value.map(r => r.id)
  groupList.value = groupList.value.filter(g => !ids.includes(g.id))
  selectedRows.value = []
  saveGroups()
}

function editGroup(row) {
  // Prosta edycja: wypełnij formularz danymi z wiersza i usuń go z listy
  newGroup.value = { norma: row.norma, material: row.material, pokrycie: row.pokrycie }
  removeGroup(row)
}

function addToDownloadList() {
  selectedRows.value.forEach(row => {
    store.addToDownloadList(row)
  })
  selectedRows.value = []
}

function saveGroups() {
  store.setDownloadList(groupList.value)
}

// Inicjalizacja z localStorage jeśli istnieje
if (store.downloadList && Array.isArray(store.downloadList)) {
  groupList.value = [...store.downloadList]
}
</script>
