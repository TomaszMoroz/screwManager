<template>
  <q-page class="column flex-center q-pa-xl">
    <q-banner v-if="status" :class="status.success ? 'bg-green-3 text-black' : 'bg-red-3 text-black'">
      {{ status.message }}
    </q-banner>
    <q-btn @click="testReyherApi" color="primary" icon="cloud_download" label="Testuj połączenie z Reyher API" class="q-mt-lg" />
    <div v-if="products.length" class="q-mt-xl">
      <q-table :rows="products" :columns="columns" row-key="sku" />
    </div>
    <div v-if="badSkus.length" class="q-mt-xl">
      <q-banner class="bg-red-2 text-black q-mb-md">
        Nieznane SKU (nie istnieją w Reyher):
      </q-banner>
      <q-table :rows="badSkus" :columns="badColumns" row-key="sku" dense />
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const status = ref(null)
const products = ref([])
const badSkus = ref([])

const columns = [
  { name: 'sku', label: 'REYHER SKU', field: 'sku', align: 'left' },
  { name: 'price', label: 'Cena', field: 'price', align: 'right' },
  { name: 'available', label: 'Dostępność', field: 'available', align: 'right' },
  { name: 'currency', label: 'Waluta', field: 'currency', align: 'right' }
]
const badColumns = [
  { name: 'sku', label: 'REYHER SKU', field: 'sku', align: 'left' },
  { name: 'error', label: 'Błąd', field: 'error', align: 'left' }
]

// Testuj tylko jedno SKU Reyher (pełny numer)
const reyherSkus = [
  '000933081009060008'
]

async function testReyherApi() {
  status.value = null
  products.value = []
  badSkus.value = []
  try {
    // 1. Pobierz token
    const tokenResp = await axios.post(
      '/reyher-token',
      {
        username: 'a.podjaski@olmet.gda.pl',
        password: '2>NkgA-B9^'
      },
      { headers: { 'Content-Type': 'application/json' } }
    )
    const token = tokenResp.data
    if (!token || typeof token !== 'string') throw new Error('Brak tokena w odpowiedzi')

    // 2. Pobierz dane o produktach
    const orderSimResp = await axios.post(
      '/reyher-ordersimulate',
      {
        items: reyherSkus.map((sku, idx) => ({ position: idx, sku, quantity: 100 }))
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )

    // Obsługa odpowiedzi: może być tablica lub obiekt
    let responses = []
    if (Array.isArray(orderSimResp.data)) {
      responses = orderSimResp.data
    } else if (orderSimResp.data?.OrderSimulateResponse) {
      responses = [orderSimResp.data.OrderSimulateResponse]
    }

    // Zbierz poprawne i błędne SKU
    const okItems = []
    const badItems = []
    for (const resp of responses) {
      try {
        if (resp?.Payload?.Items && Array.isArray(resp.Payload.Items) && resp.Payload.Items.length > 0) {
          okItems.push(...resp.Payload.Items.map(item => ({
            sku: item.SKU,
            price: item.Price,
            available: item.QuantityAvailable,
            currency: item.Currency
          })))
        }
        // Sprawdź błędne SKU
        if (resp?.StatusCode === 10 && resp?.Statusinformation?.toLowerCase().includes('unknown sku')) {
          // Wyciągnij numer SKU z komunikatu
          const match = resp.Statusinformation.match(/(\d{10,20})/)
          if (match) {
            badItems.push({ sku: match[1], error: resp.Statusinformation })
          } else {
            badItems.push({ sku: '', error: resp.Statusinformation })
          }
        }
      } catch (err) {
        // Loguj błąd mapowania odpowiedzi
        // eslint-disable-next-line no-console
        console.error('Błąd podczas przetwarzania odpowiedzi API Reyher:', err, resp)
      }
    }
    products.value = okItems
    badSkus.value = badItems
    if (okItems.length > 0) {
      status.value = { success: true, message: 'Połączenie z API Reyher OK. Dane pobrane.' }
    } else {
      status.value = { success: false, message: 'Brak poprawnych produktów. Sprawdź listę błędnych SKU.' }
    }
  } catch (err) {
    let msg = 'Błąd połączenia z API Reyher: ' + (err?.message || err)
    if (err?.response) {
      msg += ` (HTTP ${err.response.status}: ${err.response.statusText})`
      if (err.response.data) {
        msg += ' Szczegóły: ' + JSON.stringify(err.response.data).slice(0, 200) + '...'
      }
    }
    status.value = { success: false, message: msg }
  }
}
</script>
