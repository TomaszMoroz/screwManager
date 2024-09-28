import { defineStore } from 'pinia';

export const useProductsStore = defineStore('products', {
  state: () => ({
    fetchedProducts: [],
  }),
  getters: {
    getAll: (state) => state.fetchedProducts,
  },
  actions: {
    setProducts(products) {
      this.fetchedProducts = products;
    },
  },
});
