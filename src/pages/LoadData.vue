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
  await getData()
  await getProducts()

  Notify.create({
    textColor: 'white',
    color: 'green-5',
    type: 'success',
    message: 'Dane z argip pobrane. Możesz przejść do edycji produktów.'
  })
  success.value = true
 } catch (err) {
  Notify.create({
    textColor: 'white',
    color: 'red-5',
    type: 'warning',
    message: 'Cos nie tak, spróbuj jeszcze raz albo zadzwoń do Moroza ;)'
  })
  success.value = false
 }

  const allItems = flatten(products.value)
  // console.log(Array.isArray(allItems), typeof allItems, allItems.length, 'allItems', allItems)
  const sizes = allItems.map(i => i.Tags).filter(t => t.Id === 6).map(t => t.Value)
  // console.log('sizes', sizes)
  const itemsByCategory = groupBy(allItems, 'CategoryMapping')
  const adaptedItems = Object.entries(itemsByCategory).map(([groupNumber, groupItems]) => {
  const id = groupNumber
  const norm = (groupItems[0].Tags.find(t => t.Id === 2)).Value


      return {
        id,
        description: (groupItems[0].Tags.find(t => t.Id === 1)).Value,
        norm,
        products: groupItems.map(p => {
          const tags = p.Tags

          return {
          fullName: p.ProductFullName,
          ean: p.EanBarcode,
          pieces: p.SinglePackQuantityInPieces,
          price: p.YourMainPrice,
          tags
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
const norms = getAll
if (!norms.length) {
  const products = rows.value.map(r => r.products.map(p => {
    const description = p.tags.filter(t => t.Id !== 6).map(tag => tag.Value).join(' ')
    return { norm: p.norm, description }
  }))
  const initialNorms = groupBy(rows.value, 'norm').map(([key, value]) => {
    const tags = value[0].tags
    const description = tags.filter(t => t.Id !== 6).join(' ')
    return {
      id: key,
      description
    }
  })
  // console.log('initailNorms', initialNorms)
  // const initialNorms = Object.keys(normsIds).map(i => ({ id: i, description: '' }))
  setNorms(initialNorms)
}
}

async function getToken () {
  try {
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
      $q.localStorage.set('token', response.data.access_token)
    }
    access.value = response.data.access_token
  }).catch((error) =>{
    console.log(error);
  })

  } catch (err) { console.error(err) }
}

async function getData () {
  try {
    await axios({
      method: 'get',
      url: '/data',
      headers: {
        "Authorization": `Bearer ${access.value}`
      }
  }).then((response) =>{
    if (response.data) {
      data.value = response.data
    }
  }).catch((error) =>{
    console.log(error);
  })
  } catch (err) { console.error(err) }
}

async function getProducts () {
  products.value = []
    for (const cat of Object.values(categories.value)) {
      try {
        Loading.show()
       await axios({
        method: 'get',
        url: `/screw/v1/Products/Category/${cat}`,
        headers: {
          "Authorization": `Bearer ${access.value}`,
           "Content-Type": "application/json"
        }
      })
      .then(response => {
        if (response.data) {
          products.value.push(response.data)
        }
      })
      } catch (err) { console.error('this is error', err) } finally {
        Loading.hide()
        if (products.value.length) {
          setProducts(products.value)
        }
      }
    }
}

async function createXLSX() {
  // Step 1: Create a new workbook
const wb = XLSX.utils.book_new();
const dataF = productsStore.getAll
const flatten = dataF.flat()
const headers = Object.keys(flatten[0])
const index = headers.indexOf('Tags')
headers.splice(index, 1, 'Tags')
const rows = flatten.map(r => Object.values(r).map(data => {
      if (Array.isArray(data)) {
        // If the data is an array, iterate through each object
        const sortedData = data.sort((a, b) => a.Id - b.Id)
        return sortedData.map(item => {
            // Check if the item is an object
            if (typeof item === 'object' && item !== null) {
                return Object.values(item).join(', '); // Join values of the object as a string
            }
            return String(item); // Convert non-objects to string (if needed)
        }).join('; '); // Join all object strings with a delimiter
    } else if (typeof data === 'object' && data !== null) {
        // If it is a single object, return its values as a string
        return Object.values(data).join(', '); // Join values of the object
    }

    // If data is neither, return it as a string
    return String(data);
}))
// Step 2: Create sample data
const data = [
 [...headers],
 ...rows
];

// Step 3: Convert the data to a worksheet
const ws = XLSX.utils.aoa_to_sheet(data);
const headerRowHeight = [
    { hpt: 80 },
]

// Dynamically set row height based on size of data
const dataRowHeight = Array.from({ length: data[0].length }, () => ({ hpt: 30 }))

// Combine header row height and data row height
const rowHeight = [...headerRowHeight, ...dataRowHeight]

// Create a new worksheet:
const worksheet = XLSX.utils.json_to_sheet([])


// Assign height to rows
worksheet['!rows'] = rowHeight

// Add the headers to the worksheet:
XLSX.utils.sheet_add_aoa(worksheet, [headers])

// add data to sheet
XLSX.utils.sheet_add_json(worksheet, data, {
    skipHeader: true,
    origin: -1
})

// Add formatting by looping through data in sheet// Optional: Add some styling (e.g., set the first row as bold)


// Step 4: Append the worksheet to the workbook
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

// Step 5: Write the workbook to a file
XLSX.writeFile(wb, 'example.xlsx');

console.log('File written successfully!');
//   const data = productsStore.getAll
//   console.log('data', data.flat())
//   const dataFlatten = data.flat()
//   const itemKeys = Object.keys(dataFlatten[0])
//   const headers = itemKeys

// // early return if no data
// // if (!data || !data[0]) {
// //     return null
// // }

// const wb = XLSX.utils.book_new();
// console.log('wb', wb)
// const worksheet = XLSX.utils.json_to_sheet([])
// // Add the headers to the worksheet:
// XLSX.utils.sheet_add_aoa(worksheet, [headers])

// // add data to sheet
// XLSX.utils.sheet_add_json(worksheet, data, {
//     skipHeader: true,
//     origin: -1
// })

// XLSX.utils.book_append_sheet(wb, worksheet, "readme demo");
// // return worksheet
// setTimeout(() => { XLSX.writeFile(wb, "xlsx-js-style-demo.xlsx"); console.log('timeout') }, 10000)
}

onMounted(() => {
  if ($q.localStorage.has('token')) {
    const token = $q.localStorage.getItem('token')
    access.value = token
  }
})

watch(data, () => {
  show.value = true
  categories.value = data.value.map(d => d.CategoryId)
}, { deep: true })
</script>
