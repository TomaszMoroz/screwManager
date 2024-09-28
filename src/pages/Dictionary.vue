<template>
  <q-page class="column content-center">
    <div class=" row flex-center text-h4 text-grey-8">
      <div>Słowniki</div>
      <q-toggle></q-toggle>
    </div>
    <q-table
      flat bordered
      :columns="columns"
      :rows="rows"
      :filter="filter"
      row-key="id"
      :pagination="{ rowsPerPage: 20 }"

    >
    <template v-slot:top>
      <div style="min-width: 500px" class="row items-end">
        <div class="col-12">
        <q-input style="width: 200px"  dense debounce="400" color="primary" v-model="filter">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
        </div>
      </div>
    </template>

    </q-table>
  </q-page>
</template>

<script setup>
import { ref, onMounted, reactive, watch, computed } from 'vue'
import { useQuasar, Loading } from 'quasar';
import axios from 'axios'
import { flatten, groupBy, differenceWith, isEqual } from 'lodash'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore'
import { useCollection } from 'vuefire'
import { useNormsStore } from 'src/stores/normsStore'

const normsStore = useNormsStore()
const { getAll, updateNorm } = normsStore

const $q = useQuasar()

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
const filter = ref('')

const columns = computed(() => [
  { name: 'name', label: 'Norma', field: 'id' },
  { name: 'description', label: 'Opis (bez rozmiaru)', field: 'description' },
])

function editCategory (evt, row, index) {
  console.log('edit cat', evt, row, index)
}

function editDescription (props) {
  $q.dialog({
    title: `${props.row.id}`,
        message: 'Edytuj opis grupy',
        prompt: {
          model: '',
          type: 'textarea'
        },
        cancel: true,
        persistent: true
      }).onOk(data => {
        console.log('>>>> OK, received', data)
      }).onCancel(() => {
        console.log('>>>> Cancel')
      }).onDismiss(() => {
        console.log('I am triggered on both OK and Cancel')
      })
}

async function load () {

  }

onMounted(() => {
  if ($q.localStorage.has('token')) {
    rows.value = getAll
    // const token = $q.localStorage.getItem('token')
    // access.value = token
    // const dbItems = useCollection(collection(db, 'norms'), 'items')
    // const allItems = dbItems
    // const items = allItems[0].items
    // // console.log(dbItems.value[0].items)
    // existingDB.value = items || []
  }
})

</script>
