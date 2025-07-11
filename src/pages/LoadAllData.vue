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
  </q-page>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useQuasar, Loading, Notify, date } from 'quasar';
import XLSX  from 'xlsx-js-style';
import { useProductsStore } from 'src/stores/productsStore';
import { useNormsStore } from 'src/stores/normsStore';
import axios from 'axios'
import { flatten, groupBy } from 'lodash'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore'
import { useCollection } from 'vuefire'


const $q = useQuasar()
const productsStore = useProductsStore()
const { setProducts } = productsStore
const normsStore = useNormsStore()
const { setNorms } = normsStore

const firebaseConfig = {
  apiKey: "AIzaSyCzOPasvJmSpk5JkMeYZtbjdZnTwiIaiLY",
  authDomain: "screwmanager-a5f86.firebaseapp.com",
  projectId: "screwmanager-a5f86",
  storageBucket: "screwmanager-a5f86.appspot.com",
  messagingSenderId: "436708356889",
  appId: "1:436708356889:web:f91211e9ae379412cf8b88"
}

 const firebase = initializeApp(firebaseConfig)
 const db = getFirestore(firebase)

const rows = ref([])
const access = ref('')
const data = ref(null)
const categories = ref([])
const products = ref(null)
const show = ref(false)
const success = ref(null)
const summary = ref('')

const setColor = computed(() => success.value === null
? 'black'
: success
  ? 'green-5'
  : 'red-5')

async function load () {
 try {
  summary.value = ''

  await getToken()

  // Pobieramy WSZYSTKIE produkty z bazy zamiast po kategoriach
  console.log('=== POBIERANIE WSZYSTKICH PRODUKTÓW Z BAZY ===')
  const allProducts = await getAllProducts()

  if (allProducts.length > 0) {
    console.log(`✅ Pobrano wszystkie produkty: ${allProducts.length}`)

    // Sprawdzamy ile z nich ma puste CategoryMapping
    const withCategoryMapping = allProducts.filter(p => p.CategoryMapping)
    const withoutCategoryMapping = allProducts.filter(p => !p.CategoryMapping)
    console.log(`📊 Produkty z CategoryMapping: ${withCategoryMapping.length}`)
    console.log(`📊 Produkty bez CategoryMapping: ${withoutCategoryMapping.length}`)

    // Sprawdzamy czy kontrolne produkty są w pełnej liście
    const controlIds = [32138, 89263]
    const controlEans = ['5907601671316']

    controlIds.forEach(id => {
      const found = allProducts.find(p => p.ProductId === id)
      if (found) {
        console.log(`✅ Kontrolny produkt ID ${id} znaleziony w pełnej liście`)
        console.log(`   - Name: ${found.ProductFullName}`)
        console.log(`   - EAN: ${found.EanBarcode}`)
        console.log(`   - CategoryMapping: ${found.CategoryMapping || 'BRAK'}`)
        console.log(`   - Tags: ${found.Tags?.length || 0} tagów`)
      } else {
        console.log(`❌ Kontrolny produkt ID ${id} NIE MA w pełnej liście`)
      }
    })

    controlEans.forEach(ean => {
      const found = allProducts.find(p => p.EanBarcode === ean)
      if (found) {
        console.log(`✅ Kontrolny produkt EAN ${ean} znaleziony w pełnej liście`)
        console.log(`   - ID: ${found.ProductId}`)
        console.log(`   - Name: ${found.ProductFullName}`)
        console.log(`   - CategoryMapping: ${found.CategoryMapping || 'BRAK'}`)
        console.log(`   - Tags: ${found.Tags?.length || 0} tagów`)
      } else {
        console.log(`❌ Kontrolny produkt EAN ${ean} NIE MA w pełnej liście`)
      }
    })

    // Ustawiamy products.value na pełną listę produktów
    products.value = [allProducts]
    console.log('✅ Ustawiono dane na pełną listę produktów')
  } else {
    console.log('❌ Nie udało się pobrać produktów z bazy')
    throw new Error('Brak produktów w bazie')
  }

  Notify.create({
    textColor: 'white',
    color: 'green-5',
    type: 'success',
    message: 'Dane z argip pobrane. Możesz przejść do edycji produktów.'
  })
  success.value = true
 } catch (err) {
  console.error('Błąd podczas ładowania:', err)
  Notify.create({
    textColor: 'white',
    color: 'red-5',
    type: 'warning',
    message: 'Cos nie tak, spróbuj jeszcze raz albo zadzwoń do Moroza ;)'
  })
  success.value = false
 }

  const allItems = flatten(products.value)

  // Sprawdzamy dostępne klucze do grupowania
  const withCategoryMapping = allItems.filter(item => item.CategoryMapping)
  const withoutCategoryMapping = allItems.filter(item => !item.CategoryMapping)

  console.log('Wszystkie produkty:', allItems.length)
  console.log('Produkty z CategoryMapping:', withCategoryMapping.length)
  console.log('Produkty bez CategoryMapping:', withoutCategoryMapping.length)

  // Zawsze używamy kombinacji Tag1 + Tag2 (norma) żeby nie pominąć żadnych produktów
  const itemsByCategory = groupBy(allItems, (item) => {
    const tag1 = item.Tags?.find(t => t.Id === 1)?.Value || 'unknown'
    const tag2 = item.Tags?.find(t => t.Id === 2)?.Value || 'unknown'
    return `${tag1}_${tag2}`
  })

  console.log('Grupowanie po Tags (Tag1 + Tag2):', Object.keys(itemsByCategory).length, 'grup')

  // Sprawdzamy czy jakieś produkty zostały przypisane do grupy "unknown_unknown"
  const unknownGroup = itemsByCategory['unknown_unknown']
  if (unknownGroup) {
    console.log('Produkty bez tagów (unknown_unknown):', unknownGroup.length)
    console.log('Przykład produktu bez tagów:', unknownGroup[0])
  }

  // Szukamy konkretnych produktów po ID i EAN
  const searchIds = [32138, 89263]
  const searchEans = ['5907601671316']
  console.log('Szukanie produktów o ID:', searchIds)
  console.log('Szukanie produktów o EAN:', searchEans)

  searchIds.forEach(searchId => {
    const foundProduct = allItems.find(item => item.ProductId === searchId)
    if (foundProduct) {
      console.log(`Znaleziono produkt ID ${searchId}:`, foundProduct)
      console.log(`- ProductFullName: ${foundProduct.ProductFullName}`)
      console.log(`- CategoryMapping: ${foundProduct.CategoryMapping}`)
      console.log(`- EanBarcode: ${foundProduct.EanBarcode}`)
      console.log(`- Tags:`, foundProduct.Tags)

      // Sprawdzamy w której grupie się znajduje
      const tag1 = foundProduct.Tags?.find(t => t.Id === 1)?.Value || 'unknown'
      const tag2 = foundProduct.Tags?.find(t => t.Id === 2)?.Value || 'unknown'
      const groupKey = `${tag1}_${tag2}`
      console.log(`- Klucz grupy: ${groupKey}`)
      console.log(`- Produkty w tej grupie: ${itemsByCategory[groupKey]?.length || 0}`)
    } else {
      console.log(`Nie znaleziono produktu o ID ${searchId}`)
    }
  })

  searchEans.forEach(searchEan => {
    const foundProduct = allItems.find(item => item.EanBarcode === searchEan)
    if (foundProduct) {
      console.log(`Znaleziono produkt EAN ${searchEan}:`, foundProduct)
      console.log(`- ProductId: ${foundProduct.ProductId}`)
      console.log(`- ProductFullName: ${foundProduct.ProductFullName}`)
      console.log(`- CategoryMapping: ${foundProduct.CategoryMapping}`)
      console.log(`- Tags:`, foundProduct.Tags)

      // Sprawdzamy w której grupie się znajduje
      const tag1 = foundProduct.Tags?.find(t => t.Id === 1)?.Value || 'unknown'
      const tag2 = foundProduct.Tags?.find(t => t.Id === 2)?.Value || 'unknown'
      const groupKey = `${tag1}_${tag2}`
      console.log(`- Klucz grupy: ${groupKey}`)
      console.log(`- Produkty w tej grupie: ${itemsByCategory[groupKey]?.length || 0}`)
    } else {
      console.log(`Nie znaleziono produktu o EAN ${searchEan}`)
    }
  })

  console.log('Wszystkie dostępne ProductId (pierwsze 20):', allItems.slice(0, 20).map(item => item.ProductId))
  console.log('Wszystkie dostępne EAN (pierwsze 20):', allItems.slice(0, 20).map(item => item.EanBarcode))

  // Szukamy podobnych EAN kodów
  const searchEanPrefix = '5907601671'
  const similarEans = allItems.filter(item => item.EanBarcode && item.EanBarcode.startsWith(searchEanPrefix))
  console.log(`Produkty z EAN zaczynającym się od ${searchEanPrefix}:`, similarEans.length)
  if (similarEans.length > 0) {
    console.log('Pierwsze 10 podobnych EAN:', similarEans.slice(0, 10).map(item => ({
      id: item.ProductId,
      ean: item.EanBarcode,
      name: item.ProductFullName
    })))
  }

  // Sprawdzamy jakie kategorie mamy w produktach
  console.log('Unikalne kategorie w produktach:', [...new Set(allItems.map(item => item.CategoryId))].filter(Boolean).length)
  console.log('Produkty z różnymi CategoryMapping:', [...new Set(allItems.map(item => item.CategoryMapping))].filter(Boolean).length)
  const adaptedItems = Object.entries(itemsByCategory).map(([groupNumber, groupItems]) => {
  const id = groupNumber
  const norm = (groupItems[0].Tags?.find(t => t.Id === 2))?.Value || 'unknown'

      return {
        id,
        description: (groupItems[0].Tags?.find(t => t.Id === 1))?.Value || 'unknown',
        norm,
        products: groupItems.map(p => {
          const tags = p.Tags

          return {
          // Podstawowe pola (jak wcześniej)
          fullName: p.ProductFullName,
          ean: p.EanBarcode,
          pieces: p.SinglePackQuantityInPieces,
          price: p.YourMainPrice,
          tags,

          // Wszystkie oryginalne dane z API dla Excel
          originalData: p  // Zachowujemy pełne dane produktu
          }
        })
      }
  })

rows.value = adaptedItems
// if (rows.value.length) {
//   setProducts(rows.value)
//   console.log('pinia')
// }
summary.value = `Pobrane grupy: ${adaptedItems.length} - ${date.formatDate(Date.now(), 'YYYY-MM-DD HH:mm:ss')}`
console.log('norms', groupBy(rows.value, 'norm'))
const norms = normsStore.getAll
if (!norms.length) {
  const products = rows.value.map(r => r.products.map(p => {
    const description = p.tags.filter(t => t.Id !== 6).map(tag => tag.Value).join(' ')
    return { norm: r.norm, description }
  }))
  const initialNorms = Object.entries(groupBy(rows.value, 'norm')).map(([key, value]) => {
    const tags = value[0].products?.[0]?.tags || []
    const description = tags.filter(t => t.Id !== 6).map(tag => tag.Value).join(' ')
    return {
      id: key,
      description
    }
  })
  // console.log('initailNorms', initialNorms)
  // const initialNorms = Object.keys(normsIds).map(i => ({ id: i, description: '' }))
  setNorms(initialNorms)
}

// FINALNE SPRAWDZENIE - czy kontrolne produkty są w wynikach do Excel
console.log('=== FINALNE SPRAWDZENIE KONTROLNYCH PRODUKTÓW W WYNIKACH ===')
const finalProductsForExcel = adaptedItems.flatMap(group => group.products)
const controlIds = [32138, 89263]
const controlEans = ['5907601671316']

controlIds.forEach(controlId => {
  const foundInFinal = finalProductsForExcel.find(item =>
    (item.fullName && item.fullName.includes(controlId.toString())) ||
    (item.ean && item.ean.includes(controlId.toString()))
  )
  if (foundInFinal) {
    console.log(`✅ Kontrolny produkt ID ${controlId} BĘDZIE w pliku Excel`)
    console.log(`   - Name: ${foundInFinal.fullName}`)
    console.log(`   - EAN: ${foundInFinal.ean}`)
  } else {
    console.log(`❌ Kontrolny produkt ID ${controlId} NIE BĘDZIE w pliku Excel`)
  }
})

controlEans.forEach(controlEan => {
  const foundInFinal = finalProductsForExcel.find(item => item.ean === controlEan)
  if (foundInFinal) {
    console.log(`✅ Kontrolny produkt EAN ${controlEan} BĘDZIE w pliku Excel`)
    console.log(`   - Name: ${foundInFinal.fullName}`)
    console.log(`   - EAN: ${foundInFinal.ean}`)
  } else {
    console.log(`❌ Kontrolny produkt EAN ${controlEan} NIE BĘDZIE w pliku Excel`)
  }
})

console.log(`📊 PODSUMOWANIE: Finalne produkty do Excel: ${finalProductsForExcel.length}`)
}

async function getToken () {
  try {
  console.log('Pobieranie tokena...')
  const reqData = "grant_type=client_credentials&client_secret=PEEj9KudOzGdKf3lmSqgPs8zhRNx8vEORgMRnJH07XpFHF9OGeW5yBkCK9y8PdsZ&client_id=TipdZh1TQANwXKOlw7ZCUHE4pDYANfe7"
  await axios({
    method: 'post',
    url: '/token',
    data: (reqData),

    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    }
  }).then((response) =>{
    if (response.data.access_token) {
      console.log('Token otrzymany pomyślnie')
      $q.localStorage.set('token', response.data.access_token)
    } else {
      console.log('Brak tokena w odpowiedzi')
    }
    access.value = response.data.access_token
  }).catch((error) =>{
    console.log('Błąd pobierania tokena:', error);
  })

  } catch (err) { console.error('Błąd w getToken:', err) }
}

async function getAllProducts() {
  console.log('=== POBIERANIE WSZYSTKICH PRODUKTÓW Z BAZY (PAGINATED API) ===')

  const allProducts = []
  let page = 1
  const pageSize = 1000 // Duży rozmiar strony dla wydajności
  const activeOnly = false // false = wszystkie produkty (aktywne i nieaktywne)

  try {
    while (true) {
      console.log(`📄 Pobieranie strony ${page} (rozmiar: ${pageSize})...`)

      const response = await axios({
        method: 'get',
        url: `/screw/v1/Products/${page}/${pageSize}/${activeOnly}`,
        headers: {
          "Authorization": `Bearer ${access.value}`,
          "Content-Type": "application/json"
        }
      })

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`✅ Strona ${page}: pobrano ${response.data.length} produktów`)
        allProducts.push(...response.data)

        // Jeśli otrzymaliśmy mniej niż pageSize, to ostatnia strona
        if (response.data.length < pageSize) {
          console.log(`📋 Ostatnia strona osiągnięta (${response.data.length} < ${pageSize})`)
          break
        }

        page++
      } else {
        console.log(`📋 Strona ${page}: brak produktów - koniec paginacji`)
        break
      }

      // Zabezpieczenie przed nieskończoną pętlą
      if (page > 100) {
        console.log('⚠️ Osiągnięto limit 100 stron - przerwanie')
        break
      }
    }

    console.log(`✅ SUKCES: Pobrano łącznie ${allProducts.length} produktów z ${page - 1} stron`)
    return allProducts

  } catch (err) {
    console.log('❌ Błąd w paginowanym API:', err.response?.status, err.response?.statusText)
    console.log('❌ URL:', err.config?.url)
    console.log('❌ Szczegóły błędu:', err.response?.data)

    // Fallback do starych endpointów jeśli nowe API nie działa
    console.log('🔄 Próbowanie fallback endpointów...')
    return await getAllProductsFallback()
  }
}

async function getAllProductsFallback() {
  console.log('=== FALLBACK: PRÓBOWANIE STARYCH ENDPOINTÓW ===')

  const fallbackEndpoints = [
    '/screw/v1/Products',
    '/screw/v1/Products/All',
    '/Products',
    '/api/Products'
  ]

  for (const endpoint of fallbackEndpoints) {
    try {
      console.log(`🔄 Próbowanie endpointu: ${endpoint}`)
      const response = await axios({
        method: 'get',
        url: endpoint,
        headers: {
          "Authorization": `Bearer ${access.value}`,
          "Content-Type": "application/json"
        }
      })

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`✅ Sukces z fallback endpointem ${endpoint}: ${response.data.length} produktów`)
        return response.data
      }
    } catch (err) {
      console.log(`❌ Fallback endpoint ${endpoint} nie działa:`, err.response?.status)
    }
  }

  console.log('❌ Wszystkie endpointy fallback zawiodły')
  return []
}

function createXLSX() {
  console.log('=== EKSPORT DO EXCEL ===')

  if (!rows.value || rows.value.length === 0) {
    console.log('❌ Brak danych do eksportu - najpierw załaduj dane')
    Notify.create({
      color: 'red-5',
      textColor: 'white',
      icon: 'warning',
      message: 'Brak danych do eksportu. Najpierw załaduj dane z API.'
    })
    return
  }

  // Przygotowanie danych do eksportu - spłaszczenie wszystkich produktów z pełnymi danymi
  const allProducts = rows.value.flatMap(group =>
    group.products.map(product => {
      // Pobieramy oryginalne dane produktu z API
      const originalData = product.originalData || {}

      return {
        // Informacje z grupy
        GroupId: group.id,
        GroupDescription: group.description,
        GroupNorm: group.norm,

        // Wszystkie dostępne informacje o produkcie z oryginalnych danych API
        ProductId: originalData.ProductId || '',
        ProductFullName: originalData.ProductFullName || product.fullName || '',
        ProductShortName: originalData.ProductShortName || '',
        EanBarcode: originalData.EanBarcode || product.ean || '',

        // Kategorie i indeksy
        CategoryId: originalData.CategoryId || '',
        CategoryMapping: originalData.CategoryMapping || '',
        BaseProductId: originalData.BaseProductId || '',
        YourIndex: originalData.YourIndex || '',
        ManufacturerIndex: originalData.ManufacturerIndex || '',

        // Wymiary i waga
        Weight: originalData.Weight || '',
        Length: originalData.Length || '',
        Width: originalData.Width || '',
        Height: originalData.Height || '',

        // Ilości i ceny
        SinglePackQuantityInPieces: originalData.SinglePackQuantityInPieces || product.pieces || '',
        PackQuantityInPieces: originalData.PackQuantityInPieces || '',
        YourMainPrice: originalData.YourMainPrice || product.price || '',
        Currency: originalData.Currency || '',

        // Dodatkowe informacje
        ProductDescription: originalData.ProductDescription || '',
        ManufacturerName: originalData.ManufacturerName || '',
        IsActive: originalData.IsActive || '',

        // Tagi rozłożone na kolumny
        Tag1: product.tags?.find(t => t.Id === 1)?.Value || '',
        Tag2: product.tags?.find(t => t.Id === 2)?.Value || '',
        Tag3: product.tags?.find(t => t.Id === 3)?.Value || '',
        Tag4: product.tags?.find(t => t.Id === 4)?.Value || '',
        Tag5: product.tags?.find(t => t.Id === 5)?.Value || '',
        Tag6: product.tags?.find(t => t.Id === 6)?.Value || ''
      }
    })
  )

  console.log(`📊 Przygotowano ${allProducts.length} produktów do eksportu`)

  // Sprawdzamy jakie pola są dostępne w pierwszym produkcie
  if (allProducts.length > 0) {
    console.log('🔍 Dostępne pola w pierwszym produkcie:', Object.keys(allProducts[0]))
    console.log('🔍 Przykład pierwszego produktu:', allProducts[0])
  }

  // Sprawdzamy obecność kontrolnych produktów w danych do eksportu
  const controlIds = [32138, 89263]
  const controlEans = ['5907601671316']

  console.log('=== SPRAWDZENIE KONTROLNYCH PRODUKTÓW W EKSPORCIE ===')
  controlIds.forEach(controlId => {
    const found = allProducts.find(p =>
      p.ProductFullName?.includes(controlId.toString()) ||
      p.EanBarcode?.includes(controlId.toString())
    )
    if (found) {
      console.log(`✅ Kontrolny produkt ID ${controlId} BĘDZIE w Excel:`)
      console.log(`   - Name: ${found.ProductFullName}`)
      console.log(`   - EAN: ${found.EanBarcode}`)
      console.log(`   - Group: ${found.GroupDescription}`)
    } else {
      console.log(`❌ Kontrolny produkt ID ${controlId} NIE BĘDZIE w Excel`)
    }
  })

  controlEans.forEach(controlEan => {
    const found = allProducts.find(p => p.EanBarcode === controlEan)
    if (found) {
      console.log(`✅ Kontrolny produkt EAN ${controlEan} BĘDZIE w Excel:`)
      console.log(`   - Name: ${found.ProductFullName}`)
      console.log(`   - Group: ${found.GroupDescription}`)
    } else {
      console.log(`❌ Kontrolny produkt EAN ${controlEan} NIE BĘDZIE w Excel`)
    }
  })

  // Tworzenie arkusza Excel
  const wb = XLSX.utils.book_new()

  // Nagłówki kolumn - wszystkie dostępne pola
  const headers = [
    // Informacje o grupie
    'GroupId', 'GroupDescription', 'GroupNorm',

    // Podstawowe informacje o produkcie
    'ProductId', 'ProductFullName', 'ProductShortName', 'EanBarcode',

    // Kategorie i indeksy
    'CategoryId', 'CategoryMapping', 'BaseProductId', 'YourIndex', 'ManufacturerIndex',

    // Wymiary i waga
    'Weight', 'Length', 'Width', 'Height',

    // Ilości i ceny
    'SinglePackQuantityInPieces', 'PackQuantityInPieces', 'YourMainPrice', 'Currency',

    // Dodatkowe informacje
    'ProductDescription', 'ManufacturerName', 'IsActive',

    // Tagi
    'Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5', 'Tag6'
  ]

  // Konwersja danych do formatu dla Excel (zamiana kropek na przecinki w liczbach)
  const excelData = allProducts.map(product =>
    headers.map(header => {
      let value = product[header] || ''
      // Zamiana kropek na przecinki w liczbach (polskie formatowanie)
      if (typeof value === 'number') {
        value = value.toString().replace('.', ',')
      } else if (typeof value === 'string' && !isNaN(value) && value !== '') {
        value = value.replace('.', ',')
      }
      return value
    })
  )

  // Łączenie nagłówków z danymi
  const sheetData = [headers, ...excelData]

  // Tworzenie arkusza
  const ws = XLSX.utils.aoa_to_sheet(sheetData)

  // Ustawienia wysokości wierszy
  const headerRowHeight = [{ hpt: 80 }]
  const dataRowHeight = Array.from({ length: sheetData.length }, () => ({ hpt: 30 }))
  const rowHeight = [...headerRowHeight, ...dataRowHeight]
  ws['!rows'] = rowHeight

  // Dodanie arkusza do workbooka
  XLSX.utils.book_append_sheet(wb, ws, 'Wszystkie Produkty')

  // Zapisanie pliku
  const fileName = `argip_wszystkie_produkty_${date.formatDate(Date.now(), 'YYYY-MM-DD_HH-mm-ss')}.xlsx`
  XLSX.writeFile(wb, fileName)

  console.log(`✅ Plik Excel zapisany: ${fileName}`)
  console.log(`📊 Wyeksportowano ${allProducts.length} produktów w ${rows.value.length} grupach`)
  console.log(`📋 Liczba kolumn w Excel: ${headers.length}`)
  console.log(`📋 Kolumny: ${headers.join(', ')}`)

  Notify.create({
    color: 'green-5',
    textColor: 'white',
    icon: 'check_circle',
    message: `Wyeksportowano ${allProducts.length} produktów z ${headers.length} kolumnami do pliku ${fileName}`
  })
}
</script>
