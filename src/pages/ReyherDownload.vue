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
      <q-btn v-if="success && results.length" color="secondary" icon="upload" class="q-my-md" label="Pobierz xlsx" @click="exportXLSX" />
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
import axios from 'axios'

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
  { name: 'SKU', label: 'SKU', field: 'sku', align: 'left' },
  { name: 'QuantityAvailable', label: 'QuantityAvailable', field: 'qty', align: 'right' },
  { name: 'Price', label: 'Price', field: 'price', align: 'right' },
  { name: 'PriceQuantity', label: 'PriceQuantity', field: 'priceQuantity', align: 'right' },
  { name: 'Position', label: 'Position', field: 'position', align: 'right' },
  { name: 'PositionPrice', label: 'PositionPrice', field: 'positionPrice', align: 'right' },
  { name: 'PositionPriceQuantity', label: 'PositionPriceQuantity', field: 'positionPriceQuantity', align: 'right' },
  { name: 'QuantityUnit', label: 'QuantityUnit', field: 'quantityUnit', align: 'left' },
  { name: 'Currency', label: 'Currency', field: 'currency', align: 'left' },
  { name: 'Remark', label: 'Remark', field: 'remark', align: 'left' }
]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

import XLSX from 'xlsx-js-style'
function exportXLSX() {
  // Przygotuj nagłówki
  const headers = [
    'Grupa', 'Nazwa', 'SKU', 'Ilość', 'Cena', 'Ilość ceny', 'Pozycja', 'Cena pozycji', 'Ilość pozycji', 'Dostępność', 'Jednostka', 'Waluta', 'Uwagi'
  ]
  // Spłaszcz dane do wierszy
  const rows = results.value.flatMap(group =>
    group.details.map(item => [
      group.groupKey,
      group.nazwa,
      item.sku,
      item.qty,
      item.price,
      item.priceQuantity,
      item.position,
      item.positionPrice,
      item.positionPriceQuantity,
      item.quantityAvailable,
      item.quantityUnit,
      item.currency,
      item.remark
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


// --- TOKEN & API CONFIG ---
const REYHER_TOKEN_URL = '/reyher-token'
const REYHER_API_URL = '/reyher-ordersimulate'
const REYHER_USER = 'a.podjaski@olmet.gda.pl'
const REYHER_PASS = '2>NkgA-B9^'
let reyherToken = ''

async function getReyherToken() {
  if (reyherToken) return reyherToken
  try {
    const res = await axios.post(REYHER_TOKEN_URL, {
      username: REYHER_USER,
      password: REYHER_PASS
    })
    reyherToken = res.data
    return reyherToken
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message
    $q.notify({ type: 'negative', message: 'Błąd pobierania tokena Reyher: ' + msg })
    throw new Error('Błąd pobierania tokena Reyher: ' + msg)
  }
}

async function callOrdersimulate(batch, posOffset = 0) {
  const token = await getReyherToken()
  const items = batch.map((sku, idx) => ({
    position: idx + posOffset,
    sku: sku.toString().padStart(15, '0'),
    quantity: 900000 // zapytanie o 900000 sztuk
  }))
  // LOGUJEMY batch wysyłanych SKU
  console.log('callOrdersimulate batch', items)
  try {
    const res = await axios.post(REYHER_API_URL, { items }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    // LOGUJEMY pełną odpowiedź z API
    console.log('callOrdersimulate response', res.data)
    // Obsługa odpowiedzi jako tablica (nowa struktura)
    let itemsResp = []
    if (Array.isArray(res.data)) {
      itemsResp = res.data[0]?.Payload?.Items || []
    } else {
      itemsResp = res.data?.OrderSimulateResponse?.Payload?.Items || []
    }
    return itemsResp.map(item => ({
      sku: item.SKU,
      qty: item.QuantityAvailable,
      price: item.Price,
      priceQuantity: item.PriceQuantity,
      position: item.Position,
      positionPrice: item.PositionPrice,
      positionPriceQuantity: item.PositionPriceQuantity,
      quantityAvailable: item.QuantityAvailable,
      quantityUnit: item.QuantityUnit,
      currency: item.Currency,
      remark: item.Remark
    }))
  } catch (e) {
    const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message
    $q.notify({ type: 'negative', message: 'Błąd w callOrdersimulate: ' + msg })
    throw new Error('Błąd w callOrdersimulate: ' + msg)
  }
}

async function startDownload() {
  downloading.value = true
  error.value = ''
  success.value = false
  results.value = []
  let totalBatches = 0
  let completedBatches = 0
  // Upewnij się, że bierzemy tylko SKU z CSV zaczynające się od klucza grupy
  const allGroups = store.downloadList.map(dl => {
    const groupKey = dl.key
    const nazwa = dl.nazwa || ''
    // Filtruj tylko SKU z CSV zaczynające się od klucza grupy
    const skus = (store.csvData || []).filter(sku => sku.startsWith(groupKey))
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
    let posOffset = 0
    for (const batch of group.batches) {
      try {
        const response = await callOrdersimulate(batch, posOffset)
        groupItems = groupItems.concat(response.map(r => r.sku))
        details = details.concat(response)
        completedBatches++
        progress.value = completedBatches / totalBatches
        posOffset += batch.length
        await sleep(5200)
      } catch (e) {
        groupError = true
        $q.notify({ type: 'negative', message: `Błąd pobierania dla grupy ${group.groupKey}: ${e.message}` })
        break
      }
    }
    // LOGUJEMY szczegóły detali dla każdej grupy
    console.log('details for group', group.groupKey, details)
    if (groupError) {
      errorGroups.value.push({ groupKey: group.groupKey, nazwa: group.nazwa })
    } else {
      apiResults.push({ groupKey: group.groupKey, nazwa: group.nazwa, skuCount: group.skus.length, items: groupItems.length, details })
    }
  }
  // LOGUJEMY całość wyników
  console.log('results', apiResults)
  results.value = apiResults
  downloading.value = false
  if (errorGroups.value.length && apiResults.length) {
    success.value = false
    $q.notify({ type: 'warning', message: 'Pobieranie zakończone częściowo: niektóre grupy zakończone błędem.' })
  } else if (errorGroups.value.length && !apiResults.length) {
    success.value = false
    $q.notify({ type: 'negative', message: 'Pobieranie nie powiodło się dla wszystkich grup.' })
  } else {
    success.value = true
    $q.notify({ type: 'positive', message: 'Pobieranie zakończone sukcesem!' })
  }
}


</script>
