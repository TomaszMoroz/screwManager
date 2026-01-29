<template>
  <q-page class="column flex-center">
    <q-btn @click="load" class="q-mb-md q-px-lg" icon="download" :color="setColor" size="xl" square>Agrip</q-btn>
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
  const pageSize = 1000
  const activeOnly = false

  console.log('=== POBIERANIE WSZYSTKICH PRODUKTÓW (STRONY 0-30) ===')
  console.log(`🔧 Parametry: pageSize=${pageSize}, activeOnly=${activeOnly}`)

  // Statystyki do analizy
  let emptyPages = 0
  let fullPages = 0
  let partialPages = 0
  let lastNonEmptyPage = -1
  const pageSizes = []

  try {
    // Iteruj przez strony od 0 do 30
    for (let page = 0; page <= 30; page++) {
      console.log(`📄 Pobieranie strony ${page} (pageSize: ${pageSize}, activeOnly: ${activeOnly})...`)

      const response = await axios({
        method: 'get',
        url: `/screw/v1/Products/${page}/${pageSize}/${activeOnly}`,
        headers: {
          "Authorization": `Bearer ${access.value}`,
          "Content-Type": "application/json"
        }
      })

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        const currentPageSize = response.data.length
        pageSizes.push(currentPageSize)
        lastNonEmptyPage = page

        // Kategoryzuj strony
        if (currentPageSize === pageSize) {
          fullPages++
          console.log(`✅ Strona ${page}: PEŁNA - pobrano ${currentPageSize} produktów`)
        } else {
          partialPages++
          console.log(`⚠️ Strona ${page}: CZĘŚCIOWA - pobrano ${currentPageSize} produktów (${currentPageSize}/${pageSize})`)
        }

        allProducts = allProducts.concat(response.data)

        // Dodatkowy debugging dla pierwszych produktów na stronie
        if (response.data.length > 0) {
          const firstProduct = response.data[0]
          const lastProduct = response.data[response.data.length - 1]
          console.log(`   📋 Pierwszy produkt: ID=${firstProduct.ProductId}, Name="${firstProduct.ProductFullName?.substring(0, 50)}..."`)
          console.log(`   📋 Ostatni produkt: ID=${lastProduct.ProductId}, Name="${lastProduct.ProductFullName?.substring(0, 50)}..."`)

          // Sprawdź zakres ProductId na tej stronie
          const productIds = response.data.map(p => p.ProductId).filter(id => id)
          if (productIds.length > 0) {
            const minId = Math.min(...productIds)
            const maxId = Math.max(...productIds)
            console.log(`   📊 Zakres ProductId na stronie ${page}: ${minId} - ${maxId}`)
          }
        }
      } else {
        emptyPages++
        console.log(`❌ Strona ${page}: PUSTA - brak produktów`)
      }

      // Analiza po każdej stronie
      const currentTotal = allProducts.length
      console.log(`� Aktualnie pobrano: ${currentTotal} produktów (strony 0-${page})`)

      // Opóźnienie między requestami
      await new Promise(resolve => setTimeout(resolve, 100))

      // Wczesne zakończenie jeśli znajdziemy kilka pustych stron pod rząd
      if (page > 5 && emptyPages > 3 && page - lastNonEmptyPage > 2) {
        console.log(`🔄 WCZESNE ZAKOŃCZENIE: Znaleziono ${emptyPages} pustych stron, ostatnia niepusta strona: ${lastNonEmptyPage}`)
        break
      }
    }

    // SZCZEGÓŁOWA ANALIZA POBRANYCH DANYCH
    console.log('\n=== ANALIZA STRUKTURY BAZY DANYCH ===')
    console.log(`📊 Łączna liczba produktów: ${allProducts.length}`)
    console.log(`📄 Strony pełne (${pageSize} produktów): ${fullPages}`)
    console.log(`📄 Strony częściowe (<${pageSize} produktów): ${partialPages}`)
    console.log(`📄 Strony puste: ${emptyPages}`)
    console.log(`📄 Ostatnia niepusta strona: ${lastNonEmptyPage}`)

    if (pageSizes.length > 0) {
      console.log(`📄 Rozmiary stron: [${pageSizes.join(', ')}]`)
      const avgPageSize = pageSizes.reduce((a, b) => a + b, 0) / pageSizes.length
      console.log(`� Średni rozmiar strony: ${avgPageSize.toFixed(1)}`)
    }

    // Estymacja całkowitego rozmiaru bazy
    if (fullPages > 0) {
      const estimatedTotal = fullPages * pageSize + (partialPages > 0 ? pageSizes[pageSizes.length - 1] : 0)
      console.log(`🎯 Szacunkowy rozmiar całej bazy: ${estimatedTotal} produktów`)

      if (lastNonEmptyPage >= 0) {
        const suggestedPages = Math.max(30, lastNonEmptyPage + 5)
        console.log(`💡 REKOMENDACJA: Użyj ${suggestedPages} stron dla pewności (ostatnia niepusta: ${lastNonEmptyPage})`)
      }
    }

    // Analiza ProductId
    if (allProducts.length > 0) {
      const productIds = allProducts.map(p => p.ProductId).filter(id => id && !isNaN(id))
      if (productIds.length > 0) {
        const minId = Math.min(...productIds)
        const maxId = Math.max(...productIds)
        console.log(`📊 Zakres ProductId w bazie: ${minId} - ${maxId}`)
        console.log(`📊 Różnica: ${maxId - minId} (luki: ${maxId - minId + 1 - productIds.length})`)

        // Sprawdź czy są kontrolne produkty
        const controlIds = [1429, 2384, 32138, 89263]
        const foundControlIds = controlIds.filter(id => productIds.includes(id))
        console.log(`🎯 Kontrolne produkty znalezione: [${foundControlIds.join(', ')}]`)
        const missingControlIds = controlIds.filter(id => !productIds.includes(id))
        if (missingControlIds.length > 0) {
          console.log(`❌ BRAKUJĄCE kontrolne produkty: [${missingControlIds.join(', ')}]`)
        }
      }
    }

    console.log(`✅ SUKCES: Pobrano łącznie ${allProducts.length} produktów ze stron 0-${lastNonEmptyPage >= 0 ? lastNonEmptyPage : 30}`)

    // Sprawdź czy wszystkie potrzebne produkty są dostępne - fallback dla dodatkowych produktów
    const missingProducts = await getAllProductsFallback()
    if (missingProducts.length > 0) {
      console.log(`🔄 Dodawanie ${missingProducts.length} produktów z fallback`)
      // Dodaj tylko produkty które jeszcze nie istnieją
      const newMissingProducts = missingProducts.filter(product =>
        !allProducts.some(existingProduct => existingProduct.ProductId === product.ProductId)
      )
      allProducts = allProducts.concat(newMissingProducts)
      console.log(`✅ Dodano ${newMissingProducts.length} nowych produktów z fallback`)
    }

    console.log(`📊 FINALNE PODSUMOWANIE: ${allProducts.length} produktów`)
    return allProducts

  } catch (err) {
    console.error('❌ Błąd pobierania produktów:', err.response?.status, err.response?.statusText)
    console.error('❌ URL:', err.config?.url)

    // Dodatkowe informacje o błędzie
    if (err.response?.data) {
      console.error('❌ Szczegóły błędu:', err.response.data)
    }

    // Jeśli udało się pobrać jakieś dane przed błędem, używamy ich
    if (allProducts.length > 0) {
      console.log(`⚠️ Zwracam ${allProducts.length} produktów pobranych przed błędem`)
      console.log(`📊 Strony pobrane przed błędem: pełne=${fullPages}, częściowe=${partialPages}, puste=${emptyPages}`)
      return allProducts
    }

    console.log('🔄 Przechodzę do fallback')
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
