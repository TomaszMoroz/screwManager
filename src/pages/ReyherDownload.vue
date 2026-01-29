<template>
  <q-page class="q-pa-md">
    <h2>Pobierz Reyher</h2>
    <q-banner v-if="!canDownload" class="bg-grey-2 text-grey-8 q-mb-md">
      Lista do pobrania jest pusta. Dodaj grupy w konfiguracji Reyher.
    </q-banner>
    <div v-else>
      <q-btn color="primary" label="Rozpocznij pobieranie" :disable="downloading" @click="startDownload" />
      <q-linear-progress v-if="downloading" :value="progress" color="primary" class="q-mt-md" />
      <q-banner v-if="error" class="bg-red-2 text-red-8 q-mt-md">{{ error }}</q-banner>
      <q-banner v-if="errorGroups.length" class="bg-orange-2 text-orange-8 q-mt-md">
        Błędy pobierania dla grup:
        <ul class="q-ml-md">
          <li v-for="g in errorGroups" :key="g.groupKey">{{ g.groupKey }} <span v-if="g.nazwa">({{ g.nazwa }})</span></li>
        </ul>
      </q-banner>
      <q-banner v-if="success" class="bg-green-2 text-green-8 q-mt-md">Pobieranie zakończone sukcesem!</q-banner>
      <q-btn v-if="success && results.length" color="secondary" icon="upload" class="q-mb-md" label="Pobierz xlsx" @click="exportXLSX" />
      <q-table
        v-if="results.length"
        :rows="results"
        :columns="columns"
        row-key="groupKey"
        class="q-mt-lg"
        :expand="true"
      >
        <template v-slot:body="props">
          <q-tr :props="props">
            <q-td key="groupKey">{{ props.row.groupKey }}</q-td>
            <q-td key="nazwa">{{ props.row.nazwa }}</q-td>
            <q-td key="skuCount" align="right">{{ props.row.skuCount }}</q-td>
            <q-td key="items">
              <q-btn size="sm" flat color="primary" icon="expand_more" @click="props.expand = !props.expand" :label="props.expand ? 'Zwiń' : 'Pokaż detale'" />
            </q-td>
          </q-tr>
          <q-tr v-show="props.expand">
            <q-td colspan="100%" class="bg-grey-1">
              <q-table
                :rows="props.row.details"
                :columns="detailColumns"
                row-key="sku"
                dense
                flat
                hide-bottom
                :pagination="{rowsPerPage: 10}"
              />
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useReyherConfigStore } from 'src/stores/reyherConfigStore'

const $q = useQuasar()
const store = useReyherConfigStore()

const canDownload = computed(() => (store.downloadList && store.downloadList.length > 0) && (store.csvData && store.csvData.length > 0))
const downloading = ref(false)
const progress = ref(0)
const error = ref('')
const success = ref(false)
const results = ref([])
const errorGroups = ref([])

const columns = [
  { name: 'groupKey', label: 'Grupa', field: 'groupKey', align: 'left' },
  { name: 'nazwa', label: 'Nazwa', field: 'nazwa', align: 'left' },
  { name: 'skuCount', label: 'Liczba SKU', field: 'skuCount', align: 'right' },
  { name: 'items', label: 'Pobrane', field: 'items', align: 'left' }
]

const detailColumns = [
  { name: 'sku', label: 'SKU', field: 'sku', align: 'left' },
  { name: 'qty', label: 'Ilość', field: 'qty', align: 'right' },
  { name: 'price', label: 'Cena', field: 'price', align: 'right' }
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

        import XLSX from 'xlsx-js-style'
        function exportXLSX() {
          // Przygotuj nagłówki
          const headers = ['Grupa', 'Nazwa', 'SKU', 'Ilość', 'Cena']
          // Spłaszcz dane do wierszy
          const rows = results.value.flatMap(group =>
            group.details.map(item => [
              group.groupKey,
              group.nazwa,
              item.sku,
              item.qty,
              item.price
            ])
          )
          const sheetData = [headers, ...rows]
          const ws = XLSX.utils.aoa_to_sheet(sheetData)
          ws['!rows'] = [{ hpt: 80 }, ...Array.from({ length: sheetData.length }, () => ({ hpt: 30 }))]
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, 'Reyher')
          const fileName = `reyher_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.xlsx`
          XLSX.writeFile(wb, fileName)
        }

async function startDownload() {
  downloading.value = true
  error.value = ''
  success.value = false
  results.value = []
  let totalBatches = 0
  let completedBatches = 0
  const allGroups = store.downloadList.map(dl => {
    const groupKey = dl.key
    const nazwa = dl.nazwa || ''
    const skus = store.csvData.filter(sku => sku.startsWith(groupKey))
    // podziel na paczki po 100
    const batches = []
    for (let i = 0; i < skus.length; i += 100) {
      batches.push(skus.slice(i, i + 100))
    }
    return { groupKey, nazwa, batches, skus }
  })
  totalBatches = allGroups.reduce((sum, g) => sum + g.batches.length, 0)
  let apiResults = []
  errorGroups.value = []
  for (const group of allGroups) {
    let groupItems = []
    let details = []
    let groupError = false
    for (const batch of group.batches) {
      try {
        // await API call here, replace with real API
        const response = await fakeApiCall(batch)
        groupItems = groupItems.concat(response.map(r => r.sku))
        details = details.concat(response)
        completedBatches++
        progress.value = completedBatches / totalBatches
        await sleep(5200)
      } catch (e) {
        groupError = true
        $q.notify({ type: 'negative', message: `Błąd pobierania dla grupy ${group.groupKey}` })
        break
      }
    }
    if (groupError) {
      errorGroups.value.push({ groupKey: group.groupKey, nazwa: group.nazwa })
    } else {
      apiResults.push({ groupKey: group.groupKey, nazwa: group.nazwa, skuCount: group.skus.length, items: groupItems.length, details })
    }
  }
  results.value = apiResults
  downloading.value = false
  success.value = true
  $q.notify({ type: 'positive', message: 'Pobieranie zakończone!' })
}

// Fake API call for demo
async function fakeApiCall(batch) {
  // Simulate network delay and random error
  await sleep(500)
  if (Math.random() < 0.05) throw new Error('Random API error')
  // Return array of objects with details
  return batch.map(sku => ({
    sku,
    qty: Math.floor(Math.random() * 100),
    price: (Math.random() * 100).toFixed(2)
  }))
}
</script>
