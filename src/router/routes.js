const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: '/load', component: () => import('pages/LoadData.vue') },
      // { path: '/dictionary', component: () => import('pages/Dictionary.vue') },
      // { path: '/products', component: () => import('pages/Products.vue') }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
