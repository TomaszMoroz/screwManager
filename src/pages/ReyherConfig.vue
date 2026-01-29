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
        <div class="row items-center q-mb-sm">
          <div class="text-h6 col">Definiowanie grup (Norma + Materiał + Pokrycie)</div>
          <div class="col-auto text-caption text-primary cursor-pointer" @click="showDownloadListDialog = true">
            Lista do pobrania: <b>{{ (store.downloadList && store.downloadList.length) || 0 }}</b>
          </div>
        </div>
        <div class="row q-mb-md">
          <q-select
            v-model="newGroup.norma"
            :options="normaOptions"
            label="Norma (6 znaków)"
            class="col-2 q-mr-sm"
            emit-value
            map-options
          />
          <q-select
            v-model="newGroup.material"
            :options="materialOptions"
            label="Materiał (2 znaki)"
            class="col-2 q-mr-sm"
            :disable="!newGroup.norma"
            emit-value
            map-options
          />
          <q-select
            v-model="newGroup.pokrycie"
            :options="pokrycieOptions"
            label="Pokrycie (3 znaki)"
            class="col-3"
            :disable="!newGroup.material"
            emit-value
            map-options
          />
          <q-input
  v-model="newGroup.nazwa"
  label="Nazwa grupy (opcjonalnie)"
  class="col-2 q-ml-sm"
  clearable
/>
           <q-btn v-if="!editMode" outline icon="add" color="primary" label="Dodaj" class="q-ml-md" @click="addGroup" :disable="!canAddGroup" />
                    <q-btn v-else color="primary" label="Zapisz" class="q-ml-md" @click="saveEditGroup" :disable="!canAddGroup" />
                    <q-btn v-if="editMode" color="secondary" label="Anuluj" class="q-ml-md" @click="cancelEditGroup" />
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
          <template v-slot:body-cell-doPobrania="props">
  <q-td align="center">
    <q-icon v-if="isInDownloadList(props.row)" name="done" color="positive" />
    <q-icon v-else name="close" color="negative" />
  </q-td>
</template>
        </q-table>
      </q-card-section>
    </q-card>
    <q-dialog v-model="showDownloadListDialog">
      <q-card style="min-width:350px;max-width:90vw">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Edytuj listę do pobrania</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section>
          <q-input v-model="downloadListFilter" label="Filtruj listę do pobrania..." dense clearable class="q-mb-sm" />
          <div v-if="!filteredDownloadList.length" class="text-grey">Brak wpisów</div>
          <q-list v-else bordered dense>
            <q-item v-for="(item, idx) in filteredDownloadList" :key="item.key">
              <q-item-section>
                <div><strong>{{ item.key }}</strong></div>
                <div v-if="item.nazwa" class="text-caption text-grey">{{ item.nazwa }}</div>
              </q-item-section>
              <q-item-section side>
                <q-btn icon="delete" color="negative" flat round dense @click="removeFromDownloadList(getDownloadListIndex(item))" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions align="right" v-if="store.downloadList.length">
          <q-btn flat color="negative" label="Usuń wszystko" @click="clearDownloadList" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>

import { ref, computed } from 'vue'
import { useQuasar, Dialog } from 'quasar'
import { useReyherConfigStore } from 'src/stores/reyherConfigStore'

const $q = useQuasar()
const store = useReyherConfigStore()
const csvData = ref(store.csvData)
const csvFileName = ref('')
const groupList = ref(store.groupsList || [])
const selectedRows = ref([])
const tableFilter = ref('')

const newGroup = ref({ nazwa: '', norma: '', material: '', pokrycie: '' })

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
  { name: 'nazwa', label: 'Nazwa', field: 'nazwa', align: 'left', sortable: true },
  { name: 'norma', label: 'Norma', field: 'norma', align: 'left', sortable: true },
  { name: 'material', label: 'Materiał', field: 'material', align: 'left', sortable: true },
  { name: 'pokrycie', label: 'Pokrycie', field: 'pokrycie', align: 'left', sortable: true },
  { name: 'doPobrania', label: 'Do pobrania', field: 'doPobrania', align: 'center' },
  { name: 'actions', label: 'Akcje', field: 'actions', align: 'center' }
]

        const downloadListFilter = ref("")
        const filteredDownloadList = computed(() => {
          if (!downloadListFilter.value) return store.downloadList || []
          const filter = downloadListFilter.value.toLowerCase()
          return (store.downloadList || []).filter(item =>
            (item.key && item.key.toLowerCase().includes(filter)) ||
            (item.nazwa && item.nazwa.toLowerCase().includes(filter))
          )
        })
        function getDownloadListIndex(item) {
          return (store.downloadList || []).findIndex(i => i.key === item.key)
        }

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
  const exists = groupList.value.some(g =>
    g.norma === newGroup.value.norma &&
    g.material === newGroup.value.material &&
    g.pokrycie === newGroup.value.pokrycie
  )
  if (exists) {
    Dialog.create({
      title: 'Grupa już istnieje',
      message: 'Taka grupa jest już na liście. Nie można dodać duplikatu.',
      ok: 'OK',
      color: 'negative'
    })
    return
  }
groupList.value.push({
  id: Date.now() + Math.random(),
  nazwa: newGroup.value.nazwa,
  norma: newGroup.value.norma,
  material: newGroup.value.material,
  pokrycie: newGroup.value.pokrycie
})
newGroup.value = { nazwa: '', norma: '', material: '', pokrycie: '' }
  store.setGroupsList(groupList.value)
}

function removeGroup(row) {
  groupList.value = groupList.value.filter(g => g.id !== row.id)
  store.setGroupsList(groupList.value)
}

function removeSelected() {
  const ids = selectedRows.value.map(r => r.id)
  groupList.value = groupList.value.filter(g => !ids.includes(g.id))
  selectedRows.value = []
  store.setGroupsList(groupList.value)
}

const editMode = ref(false)
let editGroupId = null
function editGroup(row) {
  editMode.value = true
  editGroupId = row.id
  newGroup.value = { nazwa: row.nazwa, norma: row.norma, material: row.material, pokrycie: row.pokrycie }
}

function saveEditGroup() {
  if (!canAddGroup.value || editGroupId === null) return
  const idx = groupList.value.findIndex(g => g.id === editGroupId)
  if (idx !== -1) {
    groupList.value[idx] = {
      ...groupList.value[idx],
      nazwa: newGroup.value.nazwa,
      norma: newGroup.value.norma,
      material: newGroup.value.material,
      pokrycie: newGroup.value.pokrycie
    }
    store.setGroupsList(groupList.value)
  }
  editMode.value = false
  editGroupId = null
  newGroup.value = { nazwa: '', norma: '', material: '', pokrycie: '' }
}

function cancelEditGroup() {
  editMode.value = false
  editGroupId = null
  newGroup.value = { nazwa: '', norma: '', material: '', pokrycie: '' }
}

function addToDownloadList() {
  // Dodaj do listy pobrań tylko unikalne klucze (norma+material+pokrycie)
  const currentKeys = new Set((store.downloadList || []).map(item => item.key))
  let added = 0
  selectedRows.value.forEach(row => {
    const key = `${row.norma}${row.material}${row.pokrycie}`
    if (!currentKeys.has(key)) {
      store.addToDownloadList({ key, nazwa: row.nazwa })
      currentKeys.add(key)
      added++
    }
  })
  selectedRows.value = []
  if (added > 0) {
    $q.notify({ type: 'positive', message: `Dodano ${added} wpis(ów) do listy pobrania.` })
  } else {
    $q.notify({ type: 'info', message: 'Wybrane wpisy już znajdują się na liście pobrania.' })
  }
}


// Inicjalizacja z localStorage jeśli istnieje
if (store.groupsList && Array.isArray(store.groupsList)) {
  groupList.value = [...store.groupsList]
}

const showDownloadListDialog = ref(false)

function removeFromDownloadList(idx) {
  store.removeFromDownloadList(idx)
}

function clearDownloadList() {
  store.setDownloadList([])
  showDownloadListDialog.value = false
}

function isInDownloadList(row) {
  const key = `${row.norma}${row.material}${row.pokrycie}`
  return (store.downloadList || []).some(item => item.key === key)
}
</script>
