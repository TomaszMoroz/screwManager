<template>
  <q-page class="column flex-center">
    <q-btn @click="load" class="q-mb-md q-px-lg" icon="download" :color="setColor" size="xl" square>Import (API)</q-btn>
    <q-btn @click="createXLSX" icon="upload" size="xl" square>Pobierz xlsx</q-btn>
    <q-banner v-if="summary" class="bg-grey-9 text-white q-mx-md">
      <template v-slot:avatar>
        <q-icon name="download_done" color="white" />
      </template>
      {{ summary }}
    </q-banner>
    <div v-if="loading" class="q-mt-xl flex flex-center">
      <q-spinner size="80px" color="primary" />
      <div class="q-ml-md text-h6">Ładowanie danych z API...</div>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar, Notify, date } from 'quasar';
import XLSX from 'xlsx-js-style';
import axios from 'axios'
import { flatten, groupBy } from 'lodash'

const $q = useQuasar()
const rows = ref([])
const access = ref('')
const products = ref(null)
const success = ref(null)
const summary = ref('')
const loading = ref(false)

const setColor = computed(() => success.value === null
  ? 'black'
  : success.value
    ? 'green-5'
    : 'red-5')

async function getToken() {
  try {
    const reqData = "grant_type=client_credentials&client_secret=PEEj9KudOzGdKf3lmSqgPs8zhRNx8vEORgMRnJH07XpFHF9OGeW5yBkCK9y8PdsZ&client_id=TipdZh1TQANwXKOlw7ZCUHE4pDYANfe7"
    const response = await axios({
      method: 'post',
      url: '/token',
      data: reqData,
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    })
    access.value = response.data.access_token
    $q.localStorage.set('token', response.data.access_token)
  } catch (err) {
    console.error('Błąd pobierania tokena:', err)
  }
}

async function getAllProducts() {
  let allProducts = []
  let page = 1
  const pageSize = 1000
  const activeOnly = false
  try {
    while (true) {
      const response = await axios({
        method: 'get',
        url: `/screw/v1/Products/${page}/${pageSize}/${activeOnly}`,
        headers: {
          "Authorization": `Bearer ${access.value}`,
          "Content-Type": "application/json"
        }
      })
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        allProducts = allProducts.concat(response.data)
        if (response.data.length < pageSize) break
        page++
      } else {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return allProducts
  } catch (err) {
    console.error('Błąd pobierania produktów:', err)
    return []
  }
}

async function load() {
  loading.value = true
  try {
    summary.value = ''
    await getToken()
    const allProducts = await getAllProducts()
    if (allProducts.length > 0) {
      products.value = [allProducts]
      // Grupowanie po Tag1 + Tag2
      const itemsByCategory = groupBy(allProducts, (item) => {
        const tag1 = item.Tags?.find(t => t.Id === 1)?.Value || 'unknown'
        const tag2 = item.Tags?.find(t => t.Id === 2)?.Value || 'unknown'
        return `${tag1}_${tag2}`
      })
      const adaptedItems = Object.entries(itemsByCategory).map(([groupNumber, groupItems]) => {
        const id = groupNumber
        const norm = (groupItems[0].Tags?.find(t => t.Id === 2))?.Value || 'unknown'
        return {
          id,
          description: (groupItems[0].Tags?.find(t => t.Id === 1))?.Value || 'unknown',
          norm,
          products: groupItems.map(p => ({
            fullName: p.ProductFullName,
            ean: p.EanBarcode,
            pieces: p.SinglePackQuantityInPieces,
            price: p.YourMainPrice,
            tags: p.Tags,
            originalData: p
          }))
        }
      })
      rows.value = adaptedItems
      summary.value = `Pobrane grupy: ${adaptedItems.length} - ${date.formatDate(Date.now(), 'YYYY-MM-DD HH:mm:ss')}`
      success.value = true
    } else {
      throw new Error('Brak produktów w bazie')
    }
    Notify.create({
      textColor: 'white',
      color: 'green-5',
      type: 'success',
      message: 'Dane z argip pobrane. Możesz eksportować produkty.'
    })
  } catch (err) {
    console.error('Błąd podczas ładowania:', err)
    Notify.create({
      textColor: 'white',
      color: 'red-5',
      type: 'warning',
      message: 'Błąd pobierania danych z API.'
    })
    success.value = false
  } finally {
    loading.value = false
  }
}

function createXLSX() {
  if (!rows.value || rows.value.length === 0) {
    Notify.create({
      color: 'red-5',
      textColor: 'white',
      icon: 'warning',
      message: 'Brak danych do eksportu. Najpierw załaduj dane z API.'
    })
    return
  }
  const allProducts = rows.value.flatMap(group =>
    group.products.map(product => {
      const originalData = product.originalData || {}
      return {
        ProductId: originalData.ProductId || '',
        BaseProductId: originalData.BaseProductId || '',
        Index: originalData.Index || originalData.YourIndex || '',
        ProductFullName: originalData.ProductFullName || product.fullName || '',
        EanBarcode: originalData.EanBarcode || product.ean || '',
        MultiPackEanBarcode: originalData.MultiPackEanBarcode || '',
        SinglePackQuantityInPieces: originalData.SinglePackQuantityInPieces || product.pieces || '',
        MultiPackQuantityInPieces: originalData.MultiPackQuantityInPieces || '',
        QuantityLimitLevel1: originalData.QuantityLimitLevel1 || '',
        QuantityLimitLevel2: originalData.QuantityLimitLevel2 || '',
        PictureUrl: originalData.PictureUrl || '',
        YourMainPrice: originalData.YourMainPrice || product.price || '',
        YourPriceLevel1: originalData.YourPriceLevel1 || '',
        YourPriceLevel2: originalData.YourPriceLevel2 || '',
        CurrencyId: originalData.CurrencyId || '',
        CurrencyName: originalData.CurrencyName || '',
        PiecesInStock: originalData.PiecesInStock || '',
        OtherPossibleQuantity: originalData.OtherPossibleQuantity || '',
        NearestDilivery: originalData.NearestDilivery || '',
        YourIndex: originalData.YourIndex || '',
        YourProductFullName: originalData.YourProductFullName || '',
        YourEanBarcode: originalData.YourEanBarcode || '',
        IsActive: originalData.IsActive || '',
        BoxWeight: originalData.BoxWeight || '',
        TaxRate: originalData.TaxRate || '',
        CountryOfOrigin: originalData.CountryOfOrigin || '',
        CustomTags: originalData.CustomTags || '',
        CategoryMapping: originalData.CategoryMapping || '',
        Tag1: product.tags?.find(t => t.Id === 1)?.Value || '',
        Tag2: product.tags?.find(t => t.Id === 2)?.Value || '',
        Tag3: product.tags?.find(t => t.Id === 3)?.Value || '',
        Tag4: product.tags?.find(t => t.Id === 4)?.Value || '',
        Tag5: product.tags?.find(t => t.Id === 5)?.Value || '',
        Tag6: product.tags?.find(t => t.Id === 6)?.Value || '',
        GroupId: group.id,
        GroupDescription: group.description,
        GroupNorm: group.norm,
        ManufacturerIndex: originalData.ManufacturerIndex || '',
        Weight: originalData.Weight || '',
        Length: originalData.Length || '',
        Width: originalData.Width || '',
        Height: originalData.Height || '',
        PackQuantityInPieces: originalData.PackQuantityInPieces || '',
        Currency: originalData.Currency || '',
        ProductDescription: originalData.ProductDescription || '',
        ManufacturerName: originalData.ManufacturerName || ''
      }
    })
  )
  const headers = [
    'ProductId',
    'BaseProductId',
    'Index',
    'ProductFullName',
    'EanBarcode',
    'MultiPackEanBarcode',
    'SinglePackQuantityInPieces',
    'MultiPackQuantityInPieces',
    'QuantityLimitLevel1',
    'QuantityLimitLevel2',
    'PictureUrl',
    'YourMainPrice',
    'YourPriceLevel1',
    'YourPriceLevel2',
    'CurrencyId',
    'CurrencyName',
    'PiecesInStock',
    'OtherPossibleQuantity',
    'NearestDilivery',
    'YourIndex',
    'YourProductFullName',
    'YourEanBarcode',
    'IsActive',
    'BoxWeight',
    'TaxRate',
    'CountryOfOrigin',
    'CustomTags',
    'CategoryMapping',
    'Tag1',
    'Tag2',
    'Tag3',
    'Tag4',
    'Tag5',
    'Tag6',
    'GroupId',
    'GroupDescription',
    'GroupNorm',
    'ManufacturerIndex',
    'Weight',
    'Length',
    'Width',
    'Height',
    'PackQuantityInPieces',
    'Currency',
    'ProductDescription',
    'ManufacturerName'
  ]
  const excelData = allProducts.map(product =>
    headers.map(header => {
      let value = product[header] || ''
      if (typeof value === 'number') {
        value = value.toString().replace('.', ',')
      } else if (typeof value === 'string' && !isNaN(value) && value !== '') {
        value = value.replace('.', ',')
      }
      return value
    })
  )
  const sheetData = [headers, ...excelData]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  ws['!rows'] = [{ hpt: 80 }, ...Array.from({ length: sheetData.length }, () => ({ hpt: 30 }))]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Wszystkie Produkty')
  const fileName = 'argip.xlsx'
  XLSX.writeFile(wb, fileName)
  Notify.create({
    color: 'green-5',
    textColor: 'white',
    icon: 'check_circle',
    message: `Wyeksportowano ${allProducts.length} produktów z ${headers.length} kolumnami do pliku ${fileName}`
  })
}
</script>
