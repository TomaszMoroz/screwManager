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

function createXLSX() {
  const wb = XLSX.utils.book_new();
  const flattenData = productsStore.getAll.flat();
  const firstObject = flattenData[0] || {};
  const baseHeaders = Object.keys(firstObject).filter(key => key !== 'Tags');
  const tagHeaders = ['Tag 1', 'Tag 2', 'Tag 3', 'Tag 4', 'Tag 5', 'Tag 6'];
  const headers = [...baseHeaders, ...tagHeaders];

  const rows = flattenData.map(item => {
    const baseValues = baseHeaders.map(header => {
      let value = item[header] || '';
      if (typeof value === 'number') {
        value = value.toString().replace('.', ',');
      } else if (typeof value === 'string' && !isNaN(value)) {
        value = value.replace('.', ',');
      }
      return value;
    });

    const tags = item.Tags || [];
    const tagValues = Array(6).fill('');
    tags.forEach(tag => {
      if (tag.Id >= 1 && tag.Id <= 6) {
        let tagValue = tag.Value || '';
        if (typeof tagValue === 'number') {
          if (tag.Id !== 3) tagValue = tagValue.toString().replace('.', ',');
        } else if (typeof tagValue === 'string' && !isNaN(tagValue)) {
          if (tag.Id !== 3) tagValue = tagValue.replace('.', ',');
        }
        tagValues[tag.Id - 1] = tagValue;
      }
    });

    return [...baseValues, ...tagValues];
  });

  const sheetData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const headerRowHeight = [{ hpt: 80 }];
  const dataRowHeight = Array.from({ length: sheetData.length }, () => ({ hpt: 30 }));
  const rowHeight = [...headerRowHeight, ...dataRowHeight];
  ws['!rows'] = rowHeight;

  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, 'agrip.xlsx');
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
