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

  try {
    // Najpierw pobierz tylko aktywne produkty
    while (true) {
      const response = await axios({
        method: 'get',
        url: `/screw/v1/Products/${page}/${pageSize}/true`,
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

    // Następnie pobierz wszystkie produkty (aktywne i nieaktywne)
    page = 1
    const inactiveProducts = []
    while (true) {
      const response = await axios({
        method: 'get',
        url: `/screw/v1/Products/${page}/${pageSize}/false`,
        headers: {
          "Authorization": `Bearer ${access.value}`,
          "Content-Type": "application/json"
        }
      })
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Dodaj tylko produkty które nie są już w active products
        const newProducts = response.data.filter(product =>
          !allProducts.some(existingProduct => existingProduct.ProductId === product.ProductId)
        )
        inactiveProducts.push(...newProducts)
        if (response.data.length < pageSize) break
        page++
      } else {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Połącz wszystkie produkty
    allProducts = allProducts.concat(inactiveProducts)

    // Sprawdź czy wszystkie potrzebne produkty są dostępne
    const missingProducts = await getAllProductsFallback()
    if (missingProducts.length > 0) {
      // Dodaj tylko produkty które jeszcze nie istnieją
      const newMissingProducts = missingProducts.filter(product =>
        !allProducts.some(existingProduct => existingProduct.ProductId === product.ProductId)
      )
      allProducts = allProducts.concat(newMissingProducts)
    }

    return allProducts
  } catch (err) {
    console.error('Błąd pobierania produktów:', err)

    // Jeśli udało się pobrać jakieś dane przed błędem, używamy ich
    if (allProducts.length > 0) {
      return allProducts
    }

    return await getAllProductsFallback()
  }
}

async function getAllProductsFallback() {
  const specificProducts = []
  const productIdsToFind = [1429, 2384, 32138, 89263]

  console.log('=== STRATEGIA SKANOWANIA ID ===')

  // 1. Spróbuj pobrać konkretne produkty bezpośrednio po ID (docelowe)
  for (const productId of productIdsToFind) {
    try {
      console.log(`🔍 Szukanie produktu ID: ${productId}`)
      const response = await axios({
        method: 'get',
        url: `/screw/v1/Products/${productId}`,
        headers: {
          "Authorization": `Bearer ${access.value}`,
          "Content-Type": "application/json"
        }
      })

      if (response.data) {
        console.log(`✅ Znaleziono produkt ID ${productId}: ${response.data.ProductFullName}`)
        specificProducts.push(response.data)
      }
    } catch (err) {
      console.log(`❌ Produkt ID ${productId} nie znaleziony bezpośrednio (${err.response?.status})`)

      // Próbuj wyszukać po EAN jeśli bezpośrednie ID nie działa
      if (productId === 1429) {
        try {
          const eanResponse = await axios({
            method: 'get',
            url: `/screw/v1/Products/Ean/5907601671316`,
            headers: {
              "Authorization": `Bearer ${access.value}`,
              "Content-Type": "application/json"
            }
          })
          if (eanResponse.data) {
            console.log(`✅ Znaleziono produkt po EAN: ${eanResponse.data.ProductFullName}`)
            specificProducts.push(eanResponse.data)
          }
        } catch (eanErr) {
          console.log(`❌ Wyszukiwanie po EAN też nie powiodło się`)
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  // 2. SYSTEMATYCZNE SKANOWANIE ZAKRESÓW ID
  console.log('=== ROZPOCZYNANIE SYSTEMATYCZNEGO SKANOWANIA ===')

  const idRanges = [
    { start: 1, end: 100, name: 'Małe ID (1-100)' },
    { start: 1000, end: 1100, name: 'Średnie ID low (1000-1100)' },
    { start: 1400, end: 1500, name: 'Zakres 1429 (1400-1500)' },
    { start: 2300, end: 2400, name: 'Zakres 2384 (2300-2400)' },
    { start: 2000, end: 2100, name: 'Średnie ID (2000-2100)' },
    { start: 5000, end: 5100, name: 'Średnie ID high (5000-5100)' },
    { start: 10000, end: 10100, name: 'Duże ID low (10000-10100)' },
    { start: 30000, end: 30100, name: 'Zakres w okolicy 32138' },
    { start: 32100, end: 32200, name: 'Zakres 32138 (32100-32200)' },
    { start: 89200, end: 89300, name: 'Zakres 89263 (89200-89300)' },
    { start: 50000, end: 50100, name: 'Duże ID mid (50000-50100)' },
    { start: 100000, end: 100100, name: 'Bardzo duże ID (100000-100100)' }
  ]

  for (const range of idRanges) {
    console.log(`🔍 Skanowanie zakresu: ${range.name}`)
    let foundInRange = 0

    for (let id = range.start; id <= range.end; id++) {
      try {
        const response = await axios({
          method: 'get',
          url: `/screw/v1/Products/${id}`,
          headers: {
            "Authorization": `Bearer ${access.value}`,
            "Content-Type": "application/json"
          }
        })

        if (response.data && response.data.ProductId) {
          foundInRange++
          console.log(`✅ Znaleziono produkt ID ${id}: ${response.data.ProductFullName}`)

          // Dodaj produkt jeśli nie mamy go już
          const exists = specificProducts.find(p => p.ProductId === response.data.ProductId)
          if (!exists) {
            specificProducts.push(response.data)
          }

          // Sprawdź czy to jeden z docelowych produktów
          if (productIdsToFind.includes(id)) {
            console.log(`🎯 ZNALEZIONO DOCELOWY PRODUKT ID ${id}!`)
          }
        }
      } catch (err) {
        // Ignoruj błędy dla nieistniejących ID, ale loguj jeśli to nie 404
        if (err.response?.status !== 404) {
          console.log(`⚠️ Błąd dla ID ${id}: ${err.response?.status}`)
        }
      }

      // Opóźnienie żeby nie przeciążać API
      await new Promise(resolve => setTimeout(resolve, 20))

      // Przerwij skanowanie zakresu jeśli znajdziemy dużo produktów (oszczędność czasu)
      if (foundInRange > 20) {
        console.log(`📊 Znaleziono ${foundInRange} produktów w zakresie ${range.name} - przechodzimy do następnego`)
        break
      }
    }

    console.log(`📊 Zakres ${range.name}: znaleziono ${foundInRange} produktów`)

    // Sprawdź czy już mamy wszystkie docelowe produkty
    const foundTargetIds = specificProducts.map(p => p.ProductId).filter(id => productIdsToFind.includes(id))
    if (foundTargetIds.length === productIdsToFind.length) {
      console.log(`🎯 Znaleziono wszystkie docelowe produkty: ${foundTargetIds.join(', ')} - kończę skanowanie`)
      break
    }
  }

  // 3. Próbuj użyć quickfilter na dedykowanym endpoincie (jak wcześniej)
  console.log('=== PRÓBOWANIE QUICKFILTER ===')
  const quickfilterTerms = ['DIN', 'ISO', 'M8', 'M10', 'M12', 'śruby', 'nakrętki']

  for (const term of quickfilterTerms) {
    try {
      // Spróbuj różne warianty endpointów z quickfilter
      const possibleEndpoints = [
        `/screw/v1/Products/Search?quickfilter=${encodeURIComponent(term)}`,
        `/screw/v1/Products/Filter?quickfilter=${encodeURIComponent(term)}`,
        `/screw/v1/Products?quickfilter=${encodeURIComponent(term)}`
      ]

      for (const endpoint of possibleEndpoints) {
        try {
          const filterResponse = await axios({
            method: 'get',
            url: endpoint,
            headers: {
              "Authorization": `Bearer ${access.value}`,
              "Content-Type": "application/json"
            }
          })

          if (filterResponse.data && Array.isArray(filterResponse.data)) {
            // Szukaj konkretnych produktów w wynikach filtrowania
            const foundProducts = filterResponse.data.filter(product =>
              productIdsToFind.includes(product.ProductId)
            )
            specificProducts.push(...foundProducts)
            console.log(`✅ Quickfilter "${term}" znalazł ${foundProducts.length} docelowych produktów`)
            break // Jeśli endpoint zadziałał, przejdź do następnego terminu
          }
        } catch (endpointErr) {
          // Spróbuj następny endpoint
        }
      }
    } catch (err) {
      // Ignore quickfilter errors
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // 4. Spróbuj pobrać produkty z różnych kategorii (jak wcześniej)
  console.log('=== PRÓBOWANIE KATEGORII ===')
  try {
    const categoriesResponse = await axios({
      method: 'get',
      url: `/screw/v1/Categories`,
      headers: {
        "Authorization": `Bearer ${access.value}`,
        "Content-Type": "application/json"
      }
    })

    if (categoriesResponse.data && Array.isArray(categoriesResponse.data)) {
      // Dla każdej kategorii spróbuj pobrać produkty
      for (const category of categoriesResponse.data.slice(0, 10)) { // Zwiększ do 10 kategorii
        if (category && category.Id) {
          try {
            const categoryProductsResponse = await axios({
              method: 'get',
              url: `/screw/v1/Products/Category/${category.Id}`,
              headers: {
                "Authorization": `Bearer ${access.value}`,
                "Content-Type": "application/json"
              }
            })

            if (categoryProductsResponse.data && Array.isArray(categoryProductsResponse.data)) {
              // Szukaj konkretnych produktów w tej kategorii
              const foundProducts = categoryProductsResponse.data.filter(product =>
                productIdsToFind.includes(product.ProductId)
              )
              specificProducts.push(...foundProducts)
              console.log(`✅ Kategoria ${category.Id} zawiera ${foundProducts.length} docelowych produktów`)
            }
          } catch (categoryErr) {
            // Ignore category errors
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
  } catch (err) {
    console.log('❌ Błąd podczas pobierania kategorii')
  }

  // Usuń duplikaty
  const uniqueProducts = specificProducts.filter((product, index, self) =>
    index === self.findIndex(p => p.ProductId === product.ProductId)
  )

  console.log(`📊 PODSUMOWANIE FALLBACK: znaleziono ${uniqueProducts.length} unikalnych produktów`)
  console.log(`🎯 Docelowe produkty znalezione:`, uniqueProducts.filter(p => productIdsToFind.includes(p.ProductId)).map(p => p.ProductId))

  return uniqueProducts
}

async function load() {
  loading.value = true
  try {
    summary.value = ''
    await getToken()
    const allProducts = await getAllProducts()

    if (allProducts.length > 0) {
      products.value = [allProducts]

      // Grupowanie po Tag1 + Tag2 - produkty bez tagów też są uwzględnione
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
